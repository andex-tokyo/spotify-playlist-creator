import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/lib/auth'
import axios from 'axios'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { query, artist, filters } = body

  try {
    let searchQuery = typeof query === 'string' ? query : ''
    const artistQuery = typeof artist === 'string' ? artist.trim() : ''
    
    // Clean up the query for better search results
    searchQuery = searchQuery.trim()

    if (!searchQuery) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    
    // Try multiple search strategies for better results
    const searchStrategies = [
      artistQuery ? `track:"${searchQuery}" artist:"${artistQuery}"` : '',
      artistQuery ? `${searchQuery} ${artistQuery}` : '',
      `track:"${searchQuery}"`,
      searchQuery
    ].filter(Boolean)

    const markets = [
      filters?.preferJapanese ? 'JP' : undefined,
      undefined
    ].filter((market, index, values) => values.indexOf(market) === index)

    const toNumber = (value: unknown) => {
      if (value === '' || value === undefined || value === null) return undefined
      const number = Number(value)
      return Number.isFinite(number) ? number : undefined
    }

    const normalize = (value: string) => {
      return value
        .toLowerCase()
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const includesNormalized = (value: string, needle: string) => {
      return normalize(value).includes(normalize(needle))
    }

    const sameNormalized = (value: string, needle: string) => {
      return normalize(value) === normalize(needle)
    }

    const yearFrom = toNumber(filters?.yearFrom)
    const yearTo = toNumber(filters?.yearTo)
    const minPopularity = toNumber(filters?.minPopularity)
    
    interface SpotifyTrack {
      id: string
      name: string
      popularity: number
      preview_url: string | null
      album: {
        release_date: string
        images: Array<{ url: string }>
      }
      artists: Array<{ 
        id: string
        name: string 
      }>
    }
    
    let allTracks: SpotifyTrack[] = []
    
    for (const strategy of searchStrategies) {
      for (const market of markets) {
        const response = await axios.get('https://api.spotify.com/v1/search', {
          headers: {
            Authorization: `Bearer ${session.accessToken}`
          },
          params: {
            q: strategy,
            type: 'track',
            limit: 20,
            market
          }
        })
        
        if (response.data.tracks.items.length > 0) {
          allTracks = [...allTracks, ...response.data.tracks.items]
        }
      }
    }
    
    // Remove duplicates based on track ID
    const uniqueTracks = Array.from(
      new Map(allTracks.map(track => [track.id, track])).values()
    )
    
    let tracks = uniqueTracks

    // Sort by relevance and popularity (unless it's a custom search)
    if (!filters?.customSearch) {
      tracks.sort((a: SpotifyTrack, b: SpotifyTrack) => {
        const aArtists = a.artists.map((ar) => ar.name).join(' ')
        const bArtists = b.artists.map((ar) => ar.name).join(' ')
        
        // Calculate relevance score
        let aScore = 0
        let bScore = 0
        
        // Exact match gets absolute priority
        if (sameNormalized(a.name, searchQuery)) aScore += 1000
        if (sameNormalized(b.name, searchQuery)) bScore += 1000

        if (artistQuery && includesNormalized(aArtists, artistQuery)) aScore += 800
        if (artistQuery && includesNormalized(bArtists, artistQuery)) bScore += 800
        
        // Starts with query bonus
        if (normalize(a.name).startsWith(normalize(searchQuery))) aScore += 50
        if (normalize(b.name).startsWith(normalize(searchQuery))) bScore += 50
        
        // Contains query bonus
        if (includesNormalized(a.name, searchQuery)) aScore += 25
        if (includesNormalized(b.name, searchQuery)) bScore += 25
        
        // Add popularity as major factor (Japanese market popularity)
        // Weight popularity even more heavily for trending songs
        aScore += a.popularity * 2
        bScore += b.popularity * 2
        
        // Sort by combined score
        return bScore - aScore
      })
    } else {
      // For custom search, prioritize relevance much more than popularity
      tracks.sort((a: SpotifyTrack, b: SpotifyTrack) => {
        // Calculate relevance score
        let aScore = 0
        let bScore = 0
        
        // Exact match gets highest priority
        if (sameNormalized(a.name, searchQuery)) aScore += 2000
        if (sameNormalized(b.name, searchQuery)) bScore += 2000
        
        // Starts with query gets high priority
        if (normalize(a.name).startsWith(normalize(searchQuery))) aScore += 500
        if (normalize(b.name).startsWith(normalize(searchQuery))) bScore += 500
        
        // Contains query gets medium priority
        if (includesNormalized(a.name, searchQuery)) aScore += 200
        if (includesNormalized(b.name, searchQuery)) bScore += 200
        
        // Check artist names for relevance
        const aArtists = a.artists.map((ar) => ar.name).join(' ')
        const bArtists = b.artists.map((ar) => ar.name).join(' ')
        
        if (includesNormalized(aArtists, searchQuery)) aScore += 300
        if (includesNormalized(bArtists, searchQuery)) bScore += 300
        if (artistQuery && includesNormalized(aArtists, artistQuery)) aScore += 500
        if (artistQuery && includesNormalized(bArtists, artistQuery)) bScore += 500
        
        // Add popularity as minor factor only
        aScore += a.popularity * 0.5
        bScore += b.popularity * 0.5
        
        // Sort by combined score
        return bScore - aScore
      })
    }

    // Apply filters
    if (filters) {
      // Year filter
      if (yearFrom || yearTo) {
        tracks = tracks.filter((track: SpotifyTrack) => {
          const releaseYear = new Date(track.album.release_date).getFullYear()
          if (!Number.isFinite(releaseYear)) return false
          if (yearFrom && releaseYear < yearFrom) return false
          if (yearTo && releaseYear > yearTo) return false
          return true
        })
      }

      // Popularity filter
      if (minPopularity !== undefined) {
        tracks = tracks.filter((track: SpotifyTrack) => track.popularity >= minPopularity)
      }
    }
    
    // Limit results (more for custom search)
    tracks = tracks.slice(0, filters?.customSearch ? 20 : 5)
    
    // Check for exact match
    const hasExactMatch = tracks.some((track: SpotifyTrack) => 
      sameNormalized(track.name, searchQuery) &&
      (!artistQuery || track.artists.some((trackArtist) => includesNormalized(trackArtist.name, artistQuery)))
    )

    return NextResponse.json({ 
      tracks,
      noExactMatch: !hasExactMatch && tracks.length > 0,
      query: artistQuery ? `${searchQuery} ${artistQuery}` : searchQuery
    })
  } catch (error) {
    console.error('Spotify search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

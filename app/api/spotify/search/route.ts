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
  const { query, filters } = body

  try {
    let searchQuery = query
    
    // Clean up the query for better search results
    searchQuery = searchQuery.trim()
    
    // Try multiple search strategies for better results
    const searchStrategies = [
      searchQuery, // Original query
      `track:"${searchQuery}"`, // Exact track name search
    ]
    
    // If Japanese text is detected, add Japanese market search
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(searchQuery)
    
    let allTracks: any[] = []
    
    for (const strategy of searchStrategies) {
      const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        },
        params: {
          q: strategy,
          type: 'track',
          limit: 20,
          market: 'JP' // Always use Japanese market for popularity
        }
      })
      
      if (response.data.tracks.items.length > 0) {
        allTracks = [...allTracks, ...response.data.tracks.items]
      }
    }
    
    // Remove duplicates based on track ID
    const uniqueTracks = Array.from(
      new Map(allTracks.map(track => [track.id, track])).values()
    )
    
    let tracks = uniqueTracks

    // Sort by relevance and popularity (unless it's a custom search)
    if (!filters?.customSearch) {
      tracks.sort((a: any, b: any) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        const queryLower = searchQuery.toLowerCase()
        
        // Calculate relevance score
        let aScore = 0
        let bScore = 0
        
        // Exact match gets absolute priority
        if (aName === queryLower) aScore += 1000
        if (bName === queryLower) bScore += 1000
        
        // Starts with query bonus
        if (aName.startsWith(queryLower)) aScore += 50
        if (bName.startsWith(queryLower)) bScore += 50
        
        // Contains query bonus
        if (aName.includes(queryLower)) aScore += 25
        if (bName.includes(queryLower)) bScore += 25
        
        // Add popularity as major factor (Japanese market popularity)
        // Weight popularity even more heavily for trending songs
        aScore += a.popularity * 3
        bScore += b.popularity * 3
        
        // Sort by combined score
        return bScore - aScore
      })
    } else {
      // For custom search, prioritize relevance much more than popularity
      tracks.sort((a: any, b: any) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        const queryLower = searchQuery.toLowerCase()
        
        // Calculate relevance score
        let aScore = 0
        let bScore = 0
        
        // Exact match gets highest priority
        if (aName === queryLower) aScore += 2000
        if (bName === queryLower) bScore += 2000
        
        // Starts with query gets high priority
        if (aName.startsWith(queryLower)) aScore += 500
        if (bName.startsWith(queryLower)) bScore += 500
        
        // Contains query gets medium priority
        if (aName.includes(queryLower)) aScore += 200
        if (bName.includes(queryLower)) bScore += 200
        
        // Check artist names for relevance
        const aArtists = a.artists.map((ar: any) => ar.name.toLowerCase()).join(' ')
        const bArtists = b.artists.map((ar: any) => ar.name.toLowerCase()).join(' ')
        
        if (aArtists.includes(queryLower)) aScore += 300
        if (bArtists.includes(queryLower)) bScore += 300
        
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
      if (filters.yearFrom || filters.yearTo) {
        tracks = tracks.filter((track: any) => {
          const releaseYear = new Date(track.album.release_date).getFullYear()
          if (filters.yearFrom && releaseYear < filters.yearFrom) return false
          if (filters.yearTo && releaseYear > filters.yearTo) return false
          return true
        })
      }

      // Popularity filter
      if (filters.minPopularity !== undefined) {
        tracks = tracks.filter((track: any) => track.popularity >= filters.minPopularity)
      }
    }
    
    // Limit results (more for custom search)
    tracks = tracks.slice(0, filters?.customSearch ? 20 : 5)
    
    // Debug: Check if tracks have preview URLs
    console.log('Search query:', searchQuery)
    console.log('Found tracks:', tracks.map((t: any) => ({
      name: t.name,
      artist: t.artists[0]?.name,
      preview_url: t.preview_url,
      popularity: t.popularity
    })))
    
    // Check for exact match
    const hasExactMatch = tracks.some((track: any) => 
      track.name.toLowerCase() === searchQuery.toLowerCase()
    )

    return NextResponse.json({ 
      tracks,
      noExactMatch: !hasExactMatch && tracks.length > 0,
      query: searchQuery
    })
  } catch (error) {
    console.error('Spotify search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
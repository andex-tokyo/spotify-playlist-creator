'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { SessionProvider } from 'next-auth/react'

interface Track {
  uri: string
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    release_date: string
    images: { url: string }[]
  }
  preview_url: string
  popularity: number
}

interface FileTrack {
  filename: string
  extractedName: string
  searchResults: Track[]
  selectedTrack?: Track
  noExactMatch?: boolean
  searchQuery?: string
  customSearchQuery?: string
  customSearchResults?: Track[]
  isCustomSearching?: boolean
}

function PlaylistCreator() {
  const { data: session } = useSession()
  const [files, setFiles] = useState<FileTrack[]>([])
  const [playlistName, setPlaylistName] = useState('My Spotify Playlist')
  const [filters, setFilters] = useState({
    preferJapanese: false,
    yearFrom: '',
    yearTo: '',
    minPopularity: 0,
    genres: [] as string[]
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentPreview, setCurrentPreview] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (currentPreview && audioRef.current) {
      audioRef.current.src = currentPreview
      audioRef.current.play()
    }
  }, [currentPreview])

  const extractTrackName = (filename: string): string => {
    // Remove file extension
    let name = filename.replace(/\.[^/.]+$/, '')
    
    // Remove common prefixes (track numbers, special characters)
    name = name.replace(/^[\d\-_.★☆※♪♫]+\s*/, '')
    name = name.replace(/^[0-9]+[.\-_\s]+/, '')
    name = name.replace(/^\d{1,2}-\d{1,2}[\s._-]*/, '')
    
    // Remove "01", "02" etc at the beginning
    name = name.replace(/^0?\d{1,2}\s+/, '')
    
    // Remove underscores at the beginning
    name = name.replace(/^_+/, '')
    
    // Clean up the track name but keep feat. info for better matching
    name = name.replace(/\s*\([^)]*\)$/g, '') // Remove parentheses at the end
    name = name.replace(/\s+[-_]\s+/, ' - ') // Normalize separators
    
    // Special handling for specific patterns
    if (name.includes(' - ')) {
      // If there's a dash, take the part after it (likely the song title)
      const parts = name.split(' - ')
      if (parts.length === 2 && parts[1].length > 0) {
        name = parts[1]
      }
    }
    
    return name.trim()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || [])
    const musicFiles = uploadedFiles.filter(file => 
      /\.(mp3|m4a|flac|wav)$/i.test(file.name)
    )

    const fileTracks: FileTrack[] = musicFiles.map(file => ({
      filename: file.name,
      extractedName: extractTrackName(file.name),
      searchResults: []
    }))

    setFiles(fileTracks)
  }

  const searchTracks = async () => {
    if (!session?.accessToken) {
      signIn('spotify')
      return
    }

    setIsProcessing(true)
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const response = await fetch('/api/spotify/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: file.extractedName,
            filters
          })
        })

        if (response.ok) {
          const data = await response.json()
          setFiles(prev => {
            const updated = [...prev]
            updated[i].searchResults = data.tracks.slice(0, 5)
            if (data.tracks.length > 0) {
              updated[i].selectedTrack = data.tracks[0]
            }
            // Store whether exact match was found
            updated[i].noExactMatch = data.noExactMatch
            updated[i].searchQuery = data.query
            return updated
          })
        }
      } catch (error) {
        console.error('Search error:', error)
      }
    }

    setIsProcessing(false)
  }

  const selectTrack = (fileIndex: number, track: Track | null) => {
    setFiles(prev => {
      const updated = [...prev]
      updated[fileIndex].selectedTrack = track || undefined
      return updated
    })
  }
  const customSearch = async (fileIndex: number, query: string) => {
    setFiles(prev => {
      const updated = [...prev]
      updated[fileIndex].customSearchQuery = query
      updated[fileIndex].isCustomSearching = true
      return updated
    })

    try {
      const response = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          filters: { ...filters, customSearch: true }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setFiles(prev => {
          const updated = [...prev]
          updated[fileIndex].customSearchResults = data.tracks
          updated[fileIndex].isCustomSearching = false
          return updated
        })
      }
    } catch (error) {
      console.error('Custom search error:', error)
      setFiles(prev => {
        const updated = [...prev]
        updated[fileIndex].isCustomSearching = false
        return updated
      })
    }
  }

  const playPreview = (url: string) => {
    if (currentPreview === url) {
      audioRef.current?.pause()
      setCurrentPreview(null)
    } else {
      setCurrentPreview(url)
    }
  }

  const createPlaylist = async () => {
    if (!session?.accessToken) return

    const trackUris = files
      .filter(f => f.selectedTrack)
      .map(f => f.selectedTrack!.uri)

    try {
      const response = await fetch('/api/spotify/create-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playlistName,
          description: 'Created with Spotify Playlist Creator',
          trackUris
        })
      })

      if (response.ok) {
        const data = await response.json()
        window.open(data.url, '_blank')
      }
    } catch (error) {
      console.error('Playlist creation error:', error)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <button
          onClick={() => signIn('spotify')}
          className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-green-600"
        >
          Sign in with Spotify
        </button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Spotify Playlist Creator</h1>
        <button
          onClick={() => signOut()}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Sign out
        </button>
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Upload Music Files</label>
          <input
            type="file"
            multiple
            accept=".mp3,.m4a,.flac,.wav"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Playlist Name</label>
          <input
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.preferJapanese}
              onChange={(e) => setFilters(prev => ({ ...prev, preferJapanese: e.target.checked }))}
              className="mr-2"
            />
            Prefer Japanese
          </label>

          <input
            type="number"
            placeholder="Year from"
            value={filters.yearFrom}
            onChange={(e) => setFilters(prev => ({ ...prev, yearFrom: e.target.value }))}
            className="px-2 py-1 border rounded"
          />

          <input
            type="number"
            placeholder="Year to"
            value={filters.yearTo}
            onChange={(e) => setFilters(prev => ({ ...prev, yearTo: e.target.value }))}
            className="px-2 py-1 border rounded"
          />

          <input
            type="number"
            placeholder="Min popularity"
            value={filters.minPopularity}
            onChange={(e) => setFilters(prev => ({ ...prev, minPopularity: parseInt(e.target.value) || 0 }))}
            className="px-2 py-1 border rounded"
            min="0"
            max="100"
          />
        </div>

        <button
          onClick={searchTracks}
          disabled={files.length === 0 || isProcessing}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
        >
          {isProcessing ? 'Searching...' : 'Search Tracks'}
        </button>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          {files.map((file, fileIndex) => (
            <div key={fileIndex} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{file.filename}</h3>
              <p className="text-sm text-gray-600 mb-3">Extracted: {file.extractedName}</p>
              
              {file.noExactMatch && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 完全一致する曲が見つかりませんでした。類似の候補を表示しています。
                  </p>
                </div>
              )}
              
              {/* Custom search input */}
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  placeholder="カスタム検索..."
                  value={file.customSearchQuery || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setFiles(prev => {
                      const updated = [...prev]
                      updated[fileIndex].customSearchQuery = value
                      return updated
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && file.customSearchQuery) {
                      customSearch(fileIndex, file.customSearchQuery)
                    }
                  }}
                  className="flex-1 px-3 py-1 border rounded text-sm"
                />
                <button
                  onClick={() => customSearch(fileIndex, file.customSearchQuery || '')}
                  disabled={!file.customSearchQuery || file.isCustomSearching}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
                >
                  {file.isCustomSearching ? '検索中...' : '検索'}
                </button>
                <button
                  onClick={() => selectTrack(fileIndex, null)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  追加しない
                </button>
              </div>
              
              {/* Show custom search results if available */}
              {file.customSearchResults && file.customSearchResults.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium mb-2">カスタム検索結果:</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {file.customSearchResults.map((track) => (
                      <div
                        key={track.id}
                        className={`flex items-center space-x-3 p-2 rounded cursor-pointer hover:bg-gray-100 ${
                          file.selectedTrack?.id === track.id ? 'bg-blue-50 border-blue-300 border' : ''
                        }`}
                        onClick={() => selectTrack(fileIndex, track)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={track.album.images[2]?.url || '/placeholder.png'}
                          alt={track.album.name}
                          className="w-10 h-10 rounded"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{track.name}</p>
                          <p className="text-xs text-gray-600">
                            {track.artists.map(a => a.name).join(', ')}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          人気度: {track.popularity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {file.searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">自動検索結果:</p>
                  {file.searchResults.map((track) => (
                    <div
                      key={track.id}
                      className={`flex items-center space-x-3 p-2 rounded cursor-pointer hover:bg-gray-100 ${
                        file.selectedTrack?.id === track.id ? 'bg-blue-50 border-blue-300 border' : ''
                      }`}
                      onClick={() => selectTrack(fileIndex, track)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={track.album.images[2]?.url || '/placeholder.png'}
                        alt={track.album.name}
                        className="w-12 h-12 rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{track.name}</p>
                        <p className="text-sm text-gray-600">
                          {track.artists.map(a => a.name).join(', ')} • {track.album.name}
                        </p>
                      </div>
                      {track.preview_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            playPreview(track.preview_url)
                          }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          {currentPreview === track.preview_url ? '⏸️' : '▶️'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {files.some(f => f.selectedTrack) && (
        <button
          onClick={createPlaylist}
          className="mt-6 bg-green-500 text-white px-8 py-3 rounded-lg hover:bg-green-600"
        >
          Create Playlist ({files.filter(f => f.selectedTrack).length} tracks)
        </button>
      )}

      <audio ref={audioRef} onEnded={() => setCurrentPreview(null)} />
    </div>
  )
}

export default function Home() {
  return (
    <SessionProvider>
      <PlaylistCreator />
    </SessionProvider>
  )
}

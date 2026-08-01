'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { SessionProvider } from 'next-auth/react'
import { parseBlob } from 'music-metadata'

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

type MetadataSource = 'tag' | 'filename' | 'partial-tag'
type ReviewReason = 'タグなし' | 'タグ不足' | '候補なし' | '完全一致なし'

interface FileTrack {
  filename: string
  extractedName: string
  extractedArtist?: string
  extractedAlbum?: string
  extractedYear?: string
  metadataSource: MetadataSource
  metadataError?: string
  searchResults: Track[]
  selectedTrack?: Track
  noExactMatch?: boolean
  searchQuery?: string
  customSearchQuery?: string
  customSearchResults?: Track[]
  isCustomSearching?: boolean
  reviewed?: boolean
}

function PlaylistCreator() {
  const { data: session } = useSession()
  const [files, setFiles] = useState<FileTrack[]>([])
  const [playlistName, setPlaylistName] = useState('My Spotify Playlist')
  const [filters, setFilters] = useState({
    preferJapanese: false,
    yearFrom: '',
    yearTo: '',
    minPopularity: 0
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [isReadingMetadata, setIsReadingMetadata] = useState(false)
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [currentPreview, setCurrentPreview] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const selectedCount = files.filter(file => file.selectedTrack).length
  const skippedCount = files.filter(file => !file.selectedTrack && file.reviewed).length
  const taggedCount = files.filter(file => file.metadataSource === 'tag').length

  const getRawReviewReason = (file: FileTrack): ReviewReason | null => {
    if (file.metadataSource === 'filename') return 'タグなし'
    if (file.metadataSource === 'partial-tag') return 'タグ不足'
    if (file.searchQuery && file.searchResults.length === 0) return '候補なし'
    if (file.noExactMatch) return '完全一致なし'
    return null
  }

  const getReviewReason = (file: FileTrack): ReviewReason | null => {
    if (file.reviewed) return null
    return getRawReviewReason(file)
  }

  const reviewFiles = files
    .map((file, index) => ({ file, index, reason: getReviewReason(file) }))
    .filter((item): item is { file: FileTrack; index: number; reason: ReviewReason } => Boolean(item.reason))

  const reviewedProblemCount = files.filter(file => file.reviewed && getRawReviewReason(file)).length

  const getAdjacentReviewIndex = (currentIndex: number, direction: 'next' | 'previous') => {
    const reviewIndexes = reviewFiles.map(item => item.index)

    if (direction === 'next') {
      return reviewIndexes.find(index => index > currentIndex) ?? null
    }

    for (let i = reviewIndexes.length - 1; i >= 0; i--) {
      if (reviewIndexes[i] < currentIndex) return reviewIndexes[i]
    }

    return null
  }

  const scrollToTrack = (index: number | null) => {
    if (index === null) return
    document.getElementById(`track-${index}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  const markReviewed = (fileIndex: number, reviewed = true) => {
    setFiles(prev => {
      const updated = [...prev]
      updated[fileIndex] = { ...updated[fileIndex], reviewed }
      return updated
    })
  }

  const markReviewedAndMoveNext = (fileIndex: number) => {
    const nextIndex = getAdjacentReviewIndex(fileIndex, 'next')
    markReviewed(fileIndex, true)

    window.setTimeout(() => {
      scrollToTrack(nextIndex)
    }, 0)
  }

  useEffect(() => {
    if (currentPreview && audioRef.current) {
      audioRef.current.src = currentPreview
      audioRef.current.play()
    }
  }, [currentPreview])

  const extractTrackName = (filename: string): string => {
    let name = filename.replace(/\.[^/.]+$/, '')

    name = name.replace(/^[\d\-_.★☆※♪♫]+\s*/, '')
    name = name.replace(/^[0-9]+[.\-_\s]+/, '')
    name = name.replace(/^\d{1,2}-\d{1,2}[\s._-]*/, '')
    name = name.replace(/^0?\d{1,2}\s+/, '')
    name = name.replace(/^_+/, '')
    name = name.replace(/\s+[-_]\s+/, ' - ')

    if (name.includes(' - ')) {
      const parts = name.split(' - ')
      if (parts.length === 2 && parts[1].length > 0) {
        name = parts[1]
      }
    }

    return name.trim()
  }

  const cleanTagValue = (value?: string | null) => {
    return value?.replace(/\s+/g, ' ').trim() || ''
  }

  const getYearFromDate = (date?: string) => {
    const match = date?.match(/\d{4}/)
    return match?.[0]
  }

  const readFileTrack = async (file: File): Promise<FileTrack> => {
    const fallbackName = extractTrackName(file.name)

    try {
      const metadata = await parseBlob(file, { duration: false, skipCovers: true })
      const title = cleanTagValue(metadata.common.title)
      const artist = cleanTagValue(metadata.common.artist || metadata.common.albumartist)
      const album = cleanTagValue(metadata.common.album)
      const year = metadata.common.year?.toString() || getYearFromDate(metadata.common.date)

      if (title || artist) {
        return {
          filename: file.name,
          extractedName: title || fallbackName,
          extractedArtist: artist || undefined,
          extractedAlbum: album || undefined,
          extractedYear: year,
          metadataSource: title && artist ? 'tag' : 'partial-tag',
          searchResults: []
        }
      }
    } catch (error) {
      console.warn(`Metadata read failed for ${file.name}`, error)
      return {
        filename: file.name,
        extractedName: fallbackName,
        metadataSource: 'filename',
        metadataError: 'タグを読めなかったため、ファイル名で検索します',
        searchResults: []
      }
    }

    return {
      filename: file.name,
      extractedName: fallbackName,
      metadataSource: 'filename',
      searchResults: []
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || [])
    const musicFiles = uploadedFiles.filter(file =>
      /\.(mp3|m4a|flac|wav)$/i.test(file.name)
    )

    setPlaylistError(null)
    setIsReadingMetadata(true)
    setFiles([])

    try {
      const fileTracks = await Promise.all(musicFiles.map(readFileTrack))
      setFiles(fileTracks)
    } finally {
      setIsReadingMetadata(false)
    }
  }

  const searchTracks = async () => {
    if (!session?.accessToken) {
      signIn('spotify')
      return
    }

    setIsProcessing(true)
    setPlaylistError(null)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const response = await fetch('/api/spotify/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: file.extractedName,
            artist: file.extractedArtist,
            filters
          })
        })

        if (response.ok) {
          const data = await response.json()
          setFiles(prev => {
            const updated = [...prev]
            updated[i] = {
              ...updated[i],
              searchResults: data.tracks.slice(0, 5),
              selectedTrack: data.tracks.length > 0 ? data.tracks[0] : undefined,
              noExactMatch: data.noExactMatch,
              searchQuery: data.query,
              reviewed: false
            }
            return updated
          })
        } else {
          setFiles(prev => {
            const updated = [...prev]
            updated[i] = {
              ...updated[i],
              searchResults: [],
              selectedTrack: undefined,
              noExactMatch: true,
              searchQuery: file.extractedName,
              reviewed: false
            }
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
      updated[fileIndex] = {
        ...updated[fileIndex],
        selectedTrack: track || undefined,
        reviewed: true
      }
      return updated
    })
  }

  const customSearch = async (fileIndex: number, query: string, artist?: string) => {
    if (!query.trim()) return

    setFiles(prev => {
      const updated = [...prev]
      updated[fileIndex] = {
        ...updated[fileIndex],
        customSearchQuery: query,
        isCustomSearching: true
      }
      return updated
    })

    try {
      const response = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          artist,
          filters: { ...filters, customSearch: true }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setFiles(prev => {
          const updated = [...prev]
          updated[fileIndex] = {
            ...updated[fileIndex],
            customSearchResults: data.tracks,
            isCustomSearching: false,
            reviewed: false
          }
          return updated
        })
      } else {
        setFiles(prev => {
          const updated = [...prev]
          updated[fileIndex] = {
            ...updated[fileIndex],
            customSearchResults: [],
            isCustomSearching: false,
            reviewed: false
          }
          return updated
        })
      }
    } catch (error) {
      console.error('Custom search error:', error)
      setFiles(prev => {
        const updated = [...prev]
        updated[fileIndex] = {
          ...updated[fileIndex],
          isCustomSearching: false
        }
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
      .filter(file => file.selectedTrack)
      .map(file => file.selectedTrack!.uri)

    if (trackUris.length === 0) {
      setPlaylistError('追加する曲を1曲以上選んでください')
      return
    }

    setPlaylistError(null)

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
      } else {
        setPlaylistError('プレイリストを作成できませんでした')
      }
    } catch (error) {
      console.error('Playlist creation error:', error)
      setPlaylistError('プレイリストを作成できませんでした')
    }
  }

  const renderTrackResult = (track: Track, fileIndex: number, compact = false) => {
    const isSelected = files[fileIndex].selectedTrack?.id === track.id
    const imageSize = compact ? 'h-10 w-10' : 'h-12 w-12'

    return (
      <button
        key={track.id}
        type="button"
        onClick={() => selectTrack(fileIndex, track)}
        className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded border p-2 text-left transition ${
          isSelected
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.album.images[2]?.url || '/placeholder.png'}
          alt={track.album.name}
          className={`${imageSize} rounded object-cover`}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-950">{track.name}</span>
          <span className="block truncate text-xs text-gray-600">
            {track.artists.map(artist => artist.name).join(', ')} / {track.album.name}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          <span>{track.popularity}</span>
          {track.preview_url && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                playPreview(track.preview_url)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  playPreview(track.preview_url)
                }
              }}
              className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-white"
            >
              {currentPreview === track.preview_url ? '停止' : '試聴'}
            </span>
          )}
        </span>
      </button>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] text-gray-950">
        <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
          <div className="w-full border border-gray-200 bg-white p-6 shadow-sm">
            <p className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Spotify Playlist Creator</p>
            <h1 className="mt-3 text-2xl font-semibold">音楽ファイルからプレイリストを作成</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              ファイル名とタグ情報を使ってSpotifyの曲候補を探します。ファイル本体はSpotify検索には送信しません。
            </p>
            <button
              onClick={() => signIn('spotify')}
              className="mt-6 w-full rounded bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Spotifyでログイン
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-gray-950">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Spotify Playlist Creator</p>
            <h1 className="text-2xl font-semibold">プレイリスト作成</h1>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">取り込み</h2>
            <label className="mt-3 block text-xs font-medium text-gray-600">音楽ファイル</label>
            <input
              type="file"
              multiple
              accept=".mp3,.m4a,.flac,.wav"
              onChange={handleFileUpload}
              disabled={isReadingMetadata}
              className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-700 disabled:opacity-60"
            />
            {isReadingMetadata && (
              <p className="mt-2 text-xs text-gray-600">タグ情報を読み取っています</p>
            )}

            <label className="mt-4 block text-xs font-medium text-gray-600">プレイリスト名</label>
            <input
              type="text"
              value={playlistName}
              onChange={(event) => setPlaylistName(event.target.value)}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </section>

          <section className="border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">検索条件</h2>
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filters.preferJapanese}
                onChange={(event) => setFilters(prev => ({ ...prev, preferJapanese: event.target.checked }))}
                className="h-4 w-4"
              />
              日本マーケットを優先
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="From"
                value={filters.yearFrom}
                onChange={(event) => setFilters(prev => ({ ...prev, yearFrom: event.target.value }))}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
              <input
                type="number"
                placeholder="To"
                value={filters.yearTo}
                onChange={(event) => setFilters(prev => ({ ...prev, yearTo: event.target.value }))}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <label className="mt-3 block text-xs font-medium text-gray-600">最低人気度</label>
            <input
              type="number"
              placeholder="0"
              value={filters.minPopularity}
              onChange={(event) => setFilters(prev => ({ ...prev, minPopularity: parseInt(event.target.value) || 0 }))}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              min="0"
              max="100"
            />
            <button
              onClick={searchTracks}
              disabled={files.length === 0 || isProcessing || isReadingMetadata}
              className="mt-4 w-full rounded bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-300"
            >
              {isProcessing ? '検索中' : '曲を検索'}
            </button>
          </section>

          <section className="border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">進行状況</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-200 p-3">
                <dt className="text-xs text-gray-500">ファイル</dt>
                <dd className="mt-1 text-xl font-semibold">{files.length}</dd>
              </div>
              <div className="border border-gray-200 p-3">
                <dt className="text-xs text-gray-500">タグあり</dt>
                <dd className="mt-1 text-xl font-semibold">{taggedCount}</dd>
              </div>
              <div className="border border-yellow-200 bg-yellow-50 p-3">
                <dt className="text-xs text-yellow-800">要確認</dt>
                <dd className="mt-1 text-xl font-semibold text-yellow-950">{reviewFiles.length}</dd>
              </div>
              <div className="border border-gray-200 p-3">
                <dt className="text-xs text-gray-500">選択済み</dt>
                <dd className="mt-1 text-xl font-semibold">{selectedCount}</dd>
              </div>
            </dl>
            <button
              onClick={createPlaylist}
              disabled={selectedCount === 0}
              className="mt-4 w-full rounded bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300"
            >
              Spotifyに作成 ({selectedCount})
            </button>
            {playlistError && (
              <p className="mt-3 text-sm text-red-600">{playlistError}</p>
            )}
          </section>
        </aside>

        <section className="space-y-4">
          <div className="border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">確認キュー</h2>
                <p className="mt-1 text-sm text-gray-600">
                  曲順は下のリスト順で固定。要確認だけをここから順番にたどれます。
                </p>
              </div>
              <div className="text-sm text-gray-600">
                確認済み {reviewedProblemCount} / 未確認 {reviewFiles.length} / 除外 {skippedCount}
              </div>
            </div>

            {reviewFiles.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewFiles.map(({ file, index, reason }) => (
                  <button
                    key={`${file.filename}-${index}`}
                    onClick={() => scrollToTrack(index)}
                    className="rounded border border-yellow-300 bg-yellow-50 px-2 py-1 text-xs text-yellow-900 hover:bg-yellow-100"
                  >
                    {index + 1}. {reason}: {file.extractedName}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                {files.length === 0 ? 'ファイルを選択するとここに確認状況が表示されます。' : '未確認の曲はありません。'}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {files.map((file, fileIndex) => {
              const reason = getReviewReason(file)
              const rawReason = getRawReviewReason(file)
              const previousReviewIndex = getAdjacentReviewIndex(fileIndex, 'previous')
              const nextReviewIndex = getAdjacentReviewIndex(fileIndex, 'next')

              return (
                <article
                  key={`${file.filename}-${fileIndex}`}
                  id={`track-${fileIndex}`}
                  className={`scroll-mt-4 border bg-white p-4 shadow-sm ${
                    reason ? 'border-yellow-300' : 'border-gray-200'
                  }`}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                          #{fileIndex + 1}
                        </span>
                        {reason && (
                          <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-950">
                            {reason}
                          </span>
                        )}
                        {file.reviewed && rawReason && (
                          <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            確認済み
                          </span>
                        )}
                        <h3 className="min-w-0 truncate text-base font-semibold">{file.filename}</h3>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-gray-500">検索元</p>
                          <p className="mt-1 font-medium text-gray-950">
                            {file.extractedName}
                            {file.extractedArtist ? ` / ${file.extractedArtist}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500">タグ状態</p>
                          <p className="mt-1">
                            {file.metadataSource === 'tag' && '曲名とアーティストを取得'}
                            {file.metadataSource === 'partial-tag' && '一部タグのみ取得'}
                            {file.metadataSource === 'filename' && 'ファイル名で代用'}
                          </p>
                        </div>
                        {file.extractedAlbum && (
                          <div>
                            <p className="text-xs font-medium text-gray-500">アルバム</p>
                            <p className="mt-1">{file.extractedAlbum}</p>
                          </div>
                        )}
                        {file.searchQuery && (
                          <div>
                            <p className="text-xs font-medium text-gray-500">最後の検索</p>
                            <p className="mt-1">{file.searchQuery}</p>
                          </div>
                        )}
                      </div>

                      {file.metadataError && (
                        <p className="mt-3 border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
                          {file.metadataError}
                        </p>
                      )}
                      {file.noExactMatch && (
                        <p className="mt-3 border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
                          完全一致する曲が見つかりませんでした。候補を確認してください。
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="曲名、アーティストなど"
                          value={file.customSearchQuery || ''}
                          onChange={(event) => {
                            const value = event.target.value
                            setFiles(prev => {
                              const updated = [...prev]
                              updated[fileIndex] = {
                                ...updated[fileIndex],
                                customSearchQuery: value
                              }
                              return updated
                            })
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && file.customSearchQuery) {
                              customSearch(fileIndex, file.customSearchQuery)
                            }
                          }}
                          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                        />
                        <button
                          onClick={() => customSearch(fileIndex, file.customSearchQuery || '')}
                          disabled={!file.customSearchQuery || file.isCustomSearching}
                          className="rounded bg-gray-950 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300"
                        >
                          {file.isCustomSearching ? '検索中' : '検索'}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => customSearch(fileIndex, file.extractedName, file.extractedArtist)}
                          disabled={file.isCustomSearching}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                          タグで再検索
                        </button>
                        <button
                          onClick={() => customSearch(fileIndex, file.extractedName)}
                          disabled={file.isCustomSearching}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                          曲名だけ
                        </button>
                        <button
                          onClick={() => customSearch(fileIndex, extractTrackName(file.filename))}
                          disabled={file.isCustomSearching}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                          ファイル名
                        </button>
                        <button
                          onClick={() => selectTrack(fileIndex, null)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          追加しない
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-2">
                        <button
                          onClick={() => scrollToTrack(previousReviewIndex)}
                          disabled={previousReviewIndex === null}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          前の要確認へ
                        </button>
                        <button
                          onClick={() => scrollToTrack(nextReviewIndex)}
                          disabled={nextReviewIndex === null}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          次の要確認へ
                        </button>
                        {rawReason && (
                          <button
                            onClick={() => markReviewedAndMoveNext(fileIndex)}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            確認済みにして次へ
                          </button>
                        )}
                        {file.reviewed && rawReason && (
                          <button
                            onClick={() => markReviewed(fileIndex, false)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            要確認に戻す
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {file.customSearchResults && file.customSearchResults.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-semibold">再検索結果</p>
                      <div className="grid gap-2">
                        {file.customSearchResults.map(track => renderTrackResult(track, fileIndex, true))}
                      </div>
                    </div>
                  )}

                  {file.searchResults.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-semibold">自動検索結果</p>
                      <div className="grid gap-2">
                        {file.searchResults.map(track => renderTrackResult(track, fileIndex))}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <audio ref={audioRef} onEnded={() => setCurrentPreview(null)} />
    </main>
  )
}

export default function Home() {
  return (
    <SessionProvider>
      <PlaylistCreator />
    </SessionProvider>
  )
}

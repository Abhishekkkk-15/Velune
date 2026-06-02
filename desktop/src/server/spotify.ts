import nodeFetch from 'node-fetch'
import spotifyUrlInfo from 'spotify-url-info'

const { getTracks, getData } = spotifyUrlInfo(nodeFetch)

export interface SpotifyTrack {
  name: string
  artist: string
  durationMs?: number
}

export interface SpotifyPlaylistResult {
  title: string
  tracks: SpotifyTrack[]
}

export async function fetchSpotifyPlaylist(url: string, clientId?: string, clientSecret?: string): Promise<SpotifyPlaylistResult> {
  // If we have API credentials, use the official API for full tracks support
  if (clientId && clientSecret) {
    return fetchWithOfficialApi(url, clientId, clientSecret)
  }
  
  // Otherwise, use the public scraper
  return fetchWithScraper(url)
}

async function fetchWithScraper(url: string): Promise<SpotifyPlaylistResult> {
  try {
    // getTracks gets the list of tracks, but not the playlist title easily, 
    // getData can sometimes get title but it is more brittle. 
    // Let's try getData first to get title, then getTracks.
    const data = await getData(url)
    const title = data?.name || data?.title || 'Imported Spotify Playlist'
    
    const tracks = await getTracks(url)
    
    return {
      title,
      tracks: tracks.map((t: any) => ({
        name: t.name,
        artist: t.artist || (t.artists && t.artists.length > 0 ? t.artists[0].name : 'Unknown Artist'),
        durationMs: t.duration || t.duration_ms || t.durationMs || undefined
      }))
    }
  } catch (err: any) {
    throw new Error('Failed to fetch Spotify playlist via public scraper: ' + err.message)
  }
}

async function fetchWithOfficialApi(url: string, clientId: string, clientSecret: string): Promise<SpotifyPlaylistResult> {
  try {
    // 1. Extract Playlist ID
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/)
    if (!match) throw new Error('Invalid Spotify playlist URL')
    const playlistId = match[1]

    // 2. Get Access Token
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenRes = await nodeFetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!tokenRes.ok) throw new Error('Failed to authenticate with Spotify API. Check your Client ID and Secret.')
    const tokenData = await tokenRes.json()
    const token = tokenData.access_token

    // 3. Get Playlist Title
    const playlistRes = await nodeFetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!playlistRes.ok) throw new Error('Failed to fetch playlist details')
    const playlistData = await playlistRes.json()
    const title = playlistData.name || 'Imported Spotify Playlist'

    // 4. Fetch All Tracks (Handling Pagination)
    let tracks: SpotifyTrack[] = []
    let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=next,items(track(name,duration_ms,artists(name)))&limit=100`

    while (nextUrl) {
      const tracksRes = await nodeFetch(nextUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!tracksRes.ok) throw new Error('Failed to fetch tracks')
      
      const tracksData = await tracksRes.json()
      
      for (const item of tracksData.items) {
        if (item.track) {
          tracks.push({
            name: item.track.name,
            artist: item.track.artists && item.track.artists.length > 0 ? item.track.artists[0].name : 'Unknown Artist',
            durationMs: item.track.duration_ms
          })
        }
      }
      
      nextUrl = tracksData.next
    }

    return { title, tracks }
  } catch (err: any) {
    throw new Error('Spotify API Error: ' + err.message)
  }
}

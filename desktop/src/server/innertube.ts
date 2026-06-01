import fetch from 'node-fetch'
import { Innertube, Platform } from 'youtubei.js'
import os from 'os'
import fs from 'fs'
import path from 'path'
const YT_MUSIC_URL = 'https://music.youtube.com/youtubei/v1'

const WEB_REMIX_CLIENT = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20241015.01.00',
  hl: 'en',
  gl: 'US',
}

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  'Origin': 'https://music.youtube.com',
  'Referer': 'https://music.youtube.com/',
  'X-Youtube-Client-Name': '67',
  'X-Youtube-Client-Version': '1.20241015.01.00',
}

function buildBody(client = WEB_REMIX_CLIENT, extra: Record<string, any> = {}) {
  return { context: { client, user: {} }, ...extra }
}

async function innertubePost(endpoint: string, body: Record<string, any>) {
  const url = `${YT_MUSIC_URL}/${endpoint}?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30&prettyPrint=false`
  const res = await fetch(url, {
    method: 'POST',
    headers: BASE_HEADERS as any,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`InnerTube error: ${res.status}`)
  return res.json() as Promise<any>
}

function getThumbnail(thumbnails: any[]): string {
  if (!thumbnails || thumbnails.length === 0) return ''
  return thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || ''
}

function getRuns(runs: any[]): string {
  if (!Array.isArray(runs)) return ''
  return runs.map((r: any) => r.text || '').join('')
}

function parseDuration(text: string): number {
  const parts = text.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function detectResponsiveItemType(renderer: any): 'song' | 'video' | 'album' | 'artist' | 'playlist' {
  const nav = renderer.navigationEndpoint
  const browseId = nav?.browseEndpoint?.browseId as string | undefined
  const watchEndpoint = nav?.watchEndpoint

  if (browseId?.startsWith('MPREb') || browseId?.startsWith('OLAK')) return 'album'
  if (browseId?.startsWith('UC')) return 'artist'
  if (browseId?.startsWith('VL') || nav?.watchPlaylistEndpoint) return 'playlist'
  if (watchEndpoint?.videoId) {
    const overlay = renderer.overlay?.musicItemThumbnailOverlayRenderer
    const playBtn = overlay?.content?.musicPlayButtonRenderer
    const musicVideoType = playBtn?.playNavigationEndpoint?.watchEndpoint
      ?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType
    if (musicVideoType === 'MUSIC_VIDEO_TYPE_ATV') return 'song'
    if (musicVideoType === 'MUSIC_VIDEO_TYPE_OMV' || musicVideoType === 'MUSIC_VIDEO_TYPE_UGC') return 'video'
    return 'song'
  }
  const col1Runs = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []
  const hasPlaylistBrowse = col1Runs.find((r: any) =>
    r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('VL')
  )
  if (hasPlaylistBrowse) return 'playlist'
  return 'song'
}

function parseYTItem(renderer: any): any | null {
  if (!renderer) return null

  const col0 = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  const col1 = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  const col2 = renderer.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
    || renderer.thumbnail?.thumbnails

  const overlay = renderer.overlay?.musicItemThumbnailOverlayRenderer
  const watchEndpoint = overlay?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
    || renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      ?.find((r: any) => r.navigationEndpoint?.watchEndpoint)?.navigationEndpoint?.watchEndpoint

  const nav = renderer.navigationEndpoint
  const browseId = nav?.browseEndpoint?.browseId as string | undefined

  const itemType = detectResponsiveItemType(renderer)

  if (itemType === 'album') {
    const title = getRuns(col0 || [])
    const artistRuns = (col1 || []).filter((r: any) =>
      r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC')
    )
    return {
      type: 'album',
      id: browseId!,
      title,
      thumbnail: getThumbnail(thumbnails || []),
      subtitle: getRuns(col1 || []),
      artists: artistRuns.map((r: any) => ({
        id: r.navigationEndpoint.browseEndpoint.browseId,
        name: r.text,
      })),
    }
  }

  if (itemType === 'artist') {
    return {
      type: 'artist',
      id: browseId!,
      title: getRuns(col0 || []),
      thumbnail: getThumbnail(thumbnails || []),
      subtitle: getRuns(col1 || []),
    }
  }

  if (itemType === 'playlist') {
    const playlistBrowseId = browseId || ''
    const playlistId = nav?.watchPlaylistEndpoint?.playlistId
      || playlistBrowseId.replace('VL', '')
    return {
      type: 'playlist',
      id: playlistBrowseId,
      playlistId,
      title: getRuns(col0 || []),
      thumbnail: getThumbnail(thumbnails || []),
      subtitle: getRuns(col1 || []),
    }
  }

  const id = watchEndpoint?.videoId
    || renderer.playlistItemData?.videoId
    || nav?.watchEndpoint?.videoId

  if (!id) return null

  const artists = (col1 || [])
    .filter((r: any) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
    .map((r: any) => ({
      id: r.navigationEndpoint?.browseEndpoint?.browseId,
      name: r.text,
    }))

  const durationText = col1?.find((r: any) => /^\d+:\d+$/.test(r.text))?.text
    || col2?.find((r: any) => /^\d+:\d+$/.test(r.text))?.text
  const duration = durationText ? parseDuration(durationText) : undefined

  const album = col1?.find((r: any) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPR'))?.text
    || col2?.find((r: any) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPR'))?.text

  return {
    type: 'song',
    id,
    title: getRuns(col0 || []),
    artists,
    album,
    thumbnail: getThumbnail(thumbnails || []),
    duration,
    explicit: renderer.badges?.some((b: any) =>
      b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE'
    ) || false,
  }
}

function parseTwoRowItem(renderer: any): any | null {
  if (!renderer) return null

  const title = getRuns(renderer.title?.runs || [])
  const thumbnails = renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails
    || renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
  const thumbnail = getThumbnail(thumbnails || [])

  const nav = renderer.navigationEndpoint
  const browseId = nav?.browseEndpoint?.browseId as string | undefined
  const watchId = nav?.watchEndpoint?.videoId
  const watchPlaylistId = nav?.watchPlaylistEndpoint?.playlistId

  const subtitle = getRuns(renderer.subtitle?.runs || [])

  if (browseId?.startsWith('MPREb') || browseId?.startsWith('OLAK')) {
    return {
      type: 'album',
      id: browseId,
      playlistId: watchPlaylistId,
      title,
      thumbnail,
      subtitle,
      artists: renderer.subtitle?.runs
        ?.filter((r: any) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
        .map((r: any) => ({ id: r.navigationEndpoint.browseEndpoint.browseId, name: r.text })) || [],
    }
  }

  if (browseId?.startsWith('UC')) {
    return { type: 'artist', id: browseId, title, thumbnail, subtitle }
  }

  if (browseId?.startsWith('VL') || browseId?.startsWith('RDAMVM') || watchPlaylistId) {
    return {
      type: 'playlist',
      id: browseId || watchPlaylistId,
      playlistId: watchPlaylistId || browseId?.replace('VL', ''),
      title,
      thumbnail,
      subtitle,
    }
  }

  if (watchId) {
    return { type: 'song', id: watchId, title, thumbnail, subtitle }
  }

  return null
}

// Allow youtubei.js to evaluate deciphering scripts
Platform.shim.eval = async (data) => new Function(data.output)()

const OAUTH_FILE = path.join(os.homedir(), '.velune', 'oauth.json')

export class InnerTube {
  private yt: Innertube | null = null
  private authCode: any = null

  constructor() {
    this.initYt()
  }

  private async initYt() {
    if (this.yt) return
    this.yt = await Innertube.create()

    if (fs.existsSync(OAUTH_FILE)) {
      try {
        const cache = JSON.parse(fs.readFileSync(OAUTH_FILE, 'utf-8'))
        await this.yt.session.signIn(cache)
      } catch (e) {
        console.error('Failed to restore OAuth session:', e)
      }
    }

    this.yt.session.on('auth-pending', (data) => {
      this.authCode = data
    })

    this.yt.session.on('auth', ({ credentials }) => {
      this.authCode = null
      try {
        const dir = path.dirname(OAUTH_FILE)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(OAUTH_FILE, JSON.stringify(credentials))
      } catch (e) {
        console.error('Failed to save OAuth session:', e)
      }
    })

    this.yt.session.on('auth-error', (err) => {
      console.error('OAuth Error:', err)
      this.authCode = null
    })
  }

  async getAuthStatus() {
    await this.initYt()
    if (this.yt?.session.logged_in) {
      return { status: 'signed_in' }
    }
    if (this.authCode) {
      return { status: 'pending', code: this.authCode.user_code, url: this.authCode.verification_url }
    }
    return { status: 'signed_out' }
  }

  async startAuth() {
    await this.initYt()
    if (this.yt?.session.logged_in) return
    this.authCode = null
    this.yt?.session.signIn().catch(console.error)
    // Wait briefly for auth-pending to fire
    await new Promise(r => setTimeout(r, 1500))
    return this.getAuthStatus()
  }

  async signout() {
    if (fs.existsSync(OAUTH_FILE)) fs.unlinkSync(OAUTH_FILE)
    this.yt = await Innertube.create() // reset session
    this.authCode = null
  }

  async post(endpoint: string, body: Record<string, any>) {
    await this.initYt()
    if (this.yt?.session.logged_in) {
      try {
        const res = await this.yt.session.http.fetch(`/youtubei/v1/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (res.ok) return await res.json()
        console.warn(`Authenticated fetch failed for ${endpoint}: ${res.status}. Falling back.`)
      } catch (err) {
        console.warn(`Authenticated fetch encountered error for ${endpoint}:`, err, `. Falling back.`)
      }
    }
    return innertubePost(endpoint, body)
  }

  async getHomeFeed(historyIds?: string[]) {
    const sections: any[] = []

    if (historyIds && historyIds.length > 0) {
      try {
        // Build "Because you listened to..." using the most recent track
        const latestId = historyIds[0]
        const nextData = await this.getNext(latestId, `RDAMVM${latestId}`)
        if (nextData.queue && nextData.queue.length > 0) {
          const seedTrack = nextData.queue[0] // The seed is usually first
          sections.push({
            title: `Because you listened to ${seedTrack.title}`,
            items: nextData.queue.slice(1, 13) // Next 12 tracks
          })
        }

        // Build a "Mixed for you" from another recent track
        if (historyIds.length > 1) {
          const randomId = historyIds[Math.floor(Math.random() * Math.min(historyIds.length - 1, 4)) + 1]
          const mixData = await this.getNext(randomId, `RDAMVM${randomId}`)
          if (mixData.queue && mixData.queue.length > 0) {
            sections.push({
              title: `Mixed for you`,
              items: mixData.queue.slice(1, 13)
            })
          }
        }
      } catch (e) {
        console.error('Failed to build local personalized home:', e)
      }
    }

    const body = buildBody(WEB_REMIX_CLIENT, { browseId: 'FEmusic_home' })
    const data = await this.post('browse', body)

    const contents = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents || []

    for (const section of contents) {
      const carousel = section.musicCarouselShelfRenderer
      const grid = section.gridRenderer

      if (carousel) {
        const title = getRuns(carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs || [])
        const items = (carousel.contents || []).map((c: any) =>
          c.musicTwoRowItemRenderer ? parseTwoRowItem(c.musicTwoRowItemRenderer)
            : c.musicResponsiveListItemRenderer ? parseYTItem(c.musicResponsiveListItemRenderer)
              : null
        ).filter(Boolean)
        const tLower = title.toLowerCase()
        if (items.length > 0 && !tLower.includes('trending') && !tLower.includes('winner energy')) {
          sections.push({ title, items })
        }
      }

      if (grid) {
        const title = getRuns(grid.header?.gridHeaderRenderer?.title?.runs || [])
        const items = (grid.items || []).map((c: any) =>
          c.musicTwoRowItemRenderer ? parseTwoRowItem(c.musicTwoRowItemRenderer) : null
        ).filter(Boolean)
        const tLower = title.toLowerCase()
        if (items.length > 0 && !tLower.includes('trending') && !tLower.includes('winner energy')) {
          sections.push({ title, items })
        }
      }
    }

    return { sections }
  }

  async search(query: string, filter?: string) {
    const filterParams: Record<string, string> = {
      songs: 'EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D',
      videos: 'EgWKAQIQAWoKEAoQCRADEAQQBQ%3D%3D',
      albums: 'EgmKAQQoAWoKEAoQCRADEAQQBQ%3D%3D',
      artists: 'EgWKAQIgAWoKEAoQCRADEAQQBQ%3D%3D',
      playlists: 'EgeKAQQoAEABagoQChAJEAMQBBAF',
    }

    const body = buildBody(WEB_REMIX_CLIENT, {
      query,
      params: filter ? filterParams[filter] : undefined,
    })
    const data = await this.post('search', body)

    const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents || []

    const items: any[] = []
    const sections: any[] = []

    for (const section of tabs) {
      const shelf = section.musicShelfRenderer
      const carousel = section.musicCarouselShelfRenderer
      const cardShelf = section.musicCardShelfRenderer

      if (shelf) {
        const sectionTitle = getRuns(shelf.title?.runs || [])
        const sectionItems = (shelf.contents || []).map((c: any) =>
          c.musicResponsiveListItemRenderer ? parseYTItem(c.musicResponsiveListItemRenderer)
            : c.musicTwoRowItemRenderer ? parseTwoRowItem(c.musicTwoRowItemRenderer)
              : null
        ).filter(Boolean)
        items.push(...sectionItems)
        if (!filter) sections.push({ title: sectionTitle, items: sectionItems })
      } else if (carousel && !filter) {
        const sectionTitle = getRuns(carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs || [])
        const sectionItems = (carousel.contents || []).map((c: any) =>
          c.musicTwoRowItemRenderer ? parseTwoRowItem(c.musicTwoRowItemRenderer) : null
        ).filter(Boolean)
        if (sectionItems.length > 0) sections.push({ title: sectionTitle, items: sectionItems })
      } else if (cardShelf) {
        const cardItem = parseYTItem(cardShelf) || parseTwoRowItem(cardShelf)
        if (cardItem) items.push(cardItem)
      } else if (section.itemSectionRenderer?.contents) {
        const sectionItems = section.itemSectionRenderer.contents.map((c: any) =>
          c.musicResponsiveListItemRenderer ? parseYTItem(c.musicResponsiveListItemRenderer) : null
        ).filter(Boolean)
        items.push(...sectionItems)
      }
    }

    return { items, sections }
  }

  async getSearchSuggestions(query: string) {
    const body = buildBody(WEB_REMIX_CLIENT, { input: query })
    const data = await this.post('music/get_search_suggestions', body)

    const suggestions: string[] = []
    const contents = data?.contents || []
    for (const section of contents) {
      const items = section?.searchSuggestionsSectionRenderer?.contents || []
      for (const item of items) {
        const text = getRuns(item?.searchSuggestionRenderer?.suggestion?.runs || [])
        if (text) suggestions.push(text)
      }
    }
    return { suggestions }
  }

  async getArtist(browseId: string) {
    const body = buildBody(WEB_REMIX_CLIENT, { browseId })
    const data = await this.post('browse', body)

    const header = data?.header?.musicImmersiveHeaderRenderer
      || data?.header?.musicVisualHeaderRenderer
      || data?.header?.musicHeaderRenderer
    const name = getRuns(header?.title?.runs || [])
    const thumbnails = header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      || header?.foregroundThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
    const thumbnail = getThumbnail(thumbnails || [])
    const description = getRuns(header?.description?.runs || [])

    const sections: any[] = []
    const contents = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents || []

    for (const section of contents) {
      const musicShelf = section.musicShelfRenderer
      const carousel = section.musicCarouselShelfRenderer
      const grid = section.gridRenderer

      if (musicShelf) {
        const title = getRuns(musicShelf.title?.runs || [])
        const items = (musicShelf.contents || []).map((c: any) =>
          c.musicResponsiveListItemRenderer ? parseYTItem(c.musicResponsiveListItemRenderer) : null
        ).filter(Boolean)
        if (items.length) sections.push({ title, items })
      }

      if (carousel) {
        const title = getRuns(carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs || [])
        const items = (carousel.contents || []).map((c: any) =>
          c.musicTwoRowItemRenderer ? parseTwoRowItem(c.musicTwoRowItemRenderer) : null
        ).filter(Boolean)
        if (items.length) sections.push({ title, items })
      }

      if (grid) {
        const title = getRuns(grid.header?.gridHeaderRenderer?.title?.runs || [])
        const items = (grid.items || []).map((c: any) =>
          c.musicTwoRowItemRenderer ? parseTwoRowItem(c.musicTwoRowItemRenderer) : null
        ).filter(Boolean)
        if (items.length) sections.push({ title, items })
      }
    }

    return { id: browseId, name, thumbnail, description, sections }
  }

  async getAlbum(browseId: string) {
    const body = buildBody(WEB_REMIX_CLIENT, { browseId })
    const data = await this.post('browse', body)

    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
    const header = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer
    const title = getRuns(header?.title?.runs || [])
    const artists = (header?.straplineTextOne?.runs || [])
      .filter((r: any) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
      .map((r: any) => ({ id: r.navigationEndpoint.browseEndpoint.browseId, name: r.text }))
    const year = header?.subtitle?.runs?.at(-1)?.text
    const thumbnails = header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
    const thumbnail = getThumbnail(thumbnails || [])

    const secondaryContents = data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
    const songContents = secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents || []
    const songs = songContents.map((c: any) =>
      c.musicResponsiveListItemRenderer ? parseYTItem(c.musicResponsiveListItemRenderer) : null
    ).filter(Boolean)

    return { id: browseId, title, artists, year, thumbnail, songs }
  }

  async getPlaylist(browseId: string) {
    const body = buildBody(WEB_REMIX_CLIENT, { browseId: browseId.startsWith('VL') ? browseId : `VL${browseId}` })
    const data = await this.post('browse', body)

    const twoCol = data?.contents?.twoColumnBrowseResultsRenderer

    // Header (title + thumbnail)
    const headerNew = twoCol?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer
    const headerOld = data?.header?.musicDetailHeaderRenderer || data?.header?.musicImmersiveHeaderRenderer

    let title = ''
    let thumbnail = ''

    if (headerNew) {
      title = getRuns(headerNew.title?.runs || [])
      const thumbs = headerNew.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || []
      thumbnail = getThumbnail(thumbs)
    } else if (headerOld) {
      title = getRuns(headerOld.title?.runs || [])
      const thumbs = headerOld.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails
        || headerOld.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || []
      thumbnail = getThumbnail(thumbs)
    }

    // Songs
    const secondaryContents = twoCol?.secondaryContents?.sectionListRenderer?.contents || []
    let contents: any[] = []

    for (const section of secondaryContents) {
      const shelf = section.musicPlaylistShelfRenderer || section.musicShelfRenderer
      if (shelf?.contents?.length) {
        contents = shelf.contents
        break
      }
    }

    if (contents.length === 0) {
      contents = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents || []
    }

    const songs = contents.map((c: any) =>
      c.musicResponsiveListItemRenderer ? parseYTItem(c.musicResponsiveListItemRenderer) : null
    ).filter(Boolean)

    return { id: browseId, title, thumbnail, songs }
  }

  async getNext(videoId: string, playlistId?: string) {
    const body = buildBody(WEB_REMIX_CLIENT, { videoId, playlistId, isAudioOnly: true })
    const data = await this.post('next', body)

    const tabs = data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
      ?.watchNextTabbedResultsRenderer?.tabs || []

    const queueTab = tabs[0]?.tabRenderer?.content?.musicQueueRenderer
    const items = queueTab?.content?.playlistPanelRenderer?.contents || []

    const queue = items.map((item: any) => {
      const r = item.playlistPanelVideoRenderer
      if (!r) return null
      return {
        type: 'song',
        id: r.videoId,
        title: getRuns(r.title?.runs || []),
        artists: r.longBylineText?.runs
          ?.filter((run: any) => run.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
          .map((run: any) => ({ id: run.navigationEndpoint.browseEndpoint.browseId, name: run.text })) || [],
        thumbnail: getThumbnail(r.thumbnail?.thumbnails || []),
        duration: r.lengthText?.runs?.[0]?.text ? parseDuration(r.lengthText.runs[0].text) : undefined,
      }
    }).filter(Boolean)

    return { queue, related: [] }
  }

  async getMoodAndGenres() {
    const body = buildBody(WEB_REMIX_CLIENT, { browseId: 'FEmusic_moods_and_genres' })
    const data = await this.post('browse', body)

    const contents = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents || []

    const moods: any[] = []
    for (const section of contents) {
      const grid = section.gridRenderer
      if (grid) {
        const items = (grid.items || []).map((item: any) => {
          const r = item.musicNavigationButtonRenderer
          if (!r) return null
          return {
            title: getRuns(r.buttonText?.runs || []),
            color: r.solid?.leftStripeColor
              ? `#${(r.solid.leftStripeColor >>> 0).toString(16).slice(-6).padStart(6, '0')}`
              : '#ED5564',
            params: r.clickCommand?.browseEndpoint?.params,
            browseId: r.clickCommand?.browseEndpoint?.browseId,
          }
        }).filter(Boolean)
        moods.push(...items)
      }
    }

    return { moods }
  }

  async getCharts() {
    const body = buildBody(WEB_REMIX_CLIENT, {
      browseId: 'FEmusic_charts',
      params: 'Eg-KAQwIARAAGAAgACgAMABqChAKEAkQAxAEEAU%3D',
    })
    const data = await this.post('browse', body)

    const sections: any[] = []
    const contents = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents || []

    for (const section of contents) {
      const shelf = section.musicCarouselShelfRenderer || section.musicShelfRenderer
      if (shelf) {
        const title = getRuns(
          shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs
          || shelf.title?.runs || []
        )
        const items = (shelf.contents || []).map((c: any) =>
          c.musicResponsiveListItemRenderer ? parseYTItem(c.musicResponsiveListItemRenderer)
            : c.musicTwoRowItemRenderer ? parseTwoRowItem(c.musicTwoRowItemRenderer)
              : null
        ).filter(Boolean)
        if (items.length) sections.push({ title, items })
      }
    }

    return { sections }
  }
}

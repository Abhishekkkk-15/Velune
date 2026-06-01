// In Electron production the renderer loads from file:// — relative paths
// like /api/... resolve to file:///api/... which is wrong.
// Use the Express server directly (localhost:3001) for file:// origins,
// and same-origin (Vite proxy) for http/https origins.
function getApiBase(): string {
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "http://localhost:3001/api";
  }
  return "http://localhost:3001/api";
}
const BASE = getApiBase();

async function get<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = (await res
      .json()
      .catch(() => ({ error: res.statusText }))) as any;
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function post<T>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res
      .json()
      .catch(() => ({ error: res.statusText }))) as any;
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { method: "DELETE" });
  if (!res.ok) {
    const err = (await res
      .json()
      .catch(() => ({ error: res.statusText }))) as any;
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function proxyImage(url: string | undefined): string {
  if (!url) return "";
  // Already a proxied relative or absolute path — return as-is
  if (url.startsWith("/api/image")) return url;
  if (url.startsWith("http://127.0.0.1:3001/api/image")) {
    // Rewrite legacy absolute URL to relative
    return url.replace("http://127.0.0.1:3001", "");
  }
  const ytHosts = [
    "yt3.ggpht.com",
    "lh3.googleusercontent.com",
    "i.ytimg.com",
    "ytimg.com",
    "yt3.googleusercontent.com",
    "googleusercontent.com",
  ];
  try {
    const parsed = new URL(url);
    if (ytHosts.some((h) => parsed.hostname.endsWith(h))) {
      return `/api/image?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

export interface YTTrack {
  type: "song";
  id: string;
  title: string;
  artists: { id?: string; name: string }[];
  album?: string;
  thumbnail: string;
  duration?: number;
  explicit?: boolean;
}

export interface YTAlbum {
  type: "album";
  id: string;
  playlistId?: string;
  title: string;
  thumbnail: string;
  subtitle?: string;
  artists?: { id?: string; name: string }[];
}

export interface YTArtist {
  type: "artist";
  id: string;
  title: string;
  thumbnail: string;
  subtitle?: string;
}

export interface YTPlaylist {
  type: "playlist";
  id: string;
  playlistId?: string;
  title: string;
  thumbnail: string;
  subtitle?: string;
}

export type YTItem = YTTrack | YTAlbum | YTArtist | YTPlaylist;

export interface HomeSection {
  title: string;
  items: YTItem[];
}

export const api = {
  getAuthStatus: () =>
    get<{ status: string; code?: string; url?: string }>("/auth/status"),
  startAuth: () =>
    post<{ status: string; code?: string; url?: string }>("/auth/start"),
  signout: () => post("/auth/signout"),

  getHome: (historyIds?: string[]) =>
    get<{ sections: HomeSection[] }>(
      "/home",
      historyIds?.length ? { historyIds: historyIds.join(",") } : undefined,
    ),

  search: (q: string, filter?: string) =>
    get<{ items: YTItem[]; sections: { title: string; items: YTItem[] }[] }>(
      "/search",
      { q, filter },
    ),

  getSearchSuggestions: (q: string) =>
    get<{ suggestions: string[] }>("/search/suggestions", { q }),

  getArtist: (id: string) =>
    get<{
      id: string;
      name: string;
      thumbnail: string;
      description?: string;
      sections: { title: string; items: YTItem[] }[];
    }>(`/artist/${id}`),

  getAlbum: (id: string) =>
    get<{
      id: string;
      title: string;
      artists: any[];
      year?: string;
      thumbnail: string;
      songs: YTTrack[];
    }>(`/album/${id}`),

  getPlaylist: (id: string) =>
    get<{ id: string; title: string; thumbnail: string; songs: YTTrack[] }>(
      `/playlist/${id}`,
    ),

  getNext: (videoId: string, playlistId?: string) =>
    get<{ queue: YTTrack[]; related: YTItem[] }>("/next", {
      videoId,
      playlistId,
    }),

  getStream: async (videoId: string) => {
    const res = await get<{ url: string; offline?: boolean }>("/stream", {
      videoId,
    });
    // The server returns a path like /api/stream/proxy/:id or /api/offline/:id.
    // In file:// (Electron production) we must prefix with http://localhost:3001
    // so the audio element can reach the Express server.
    if (window.location.protocol === "file:" && res.url.startsWith("/api/")) {
      res.url = `http://localhost:3001${res.url}`;
    }
    return res;
  },

  prefetchStream: (videoId: string): void => {
    fetch(`${BASE}/stream/prefetch/${videoId}`).catch(() => {});
  },

  getLyrics: (title: string, artist: string, duration?: number) =>
    get<{
      synced: boolean;
      lines: { time: number; text: string }[];
      plain?: string;
    } | null>("/lyrics", { title, artist, duration }),

  getMoods: () =>
    get<{
      moods: {
        title: string;
        color: string;
        params?: string;
        browseId?: string;
      }[];
    }>("/moods"),

  getCharts: () => get<{ sections: HomeSection[] }>("/charts"),

  getCacheStats: () =>
    get<{ count: number; sizeBytes: number }>("/cache/stats"),

  clearCache: () => post("/cache/clear", {}),

  downloadTrack: (videoId: string) =>
    post<{ ok: boolean; status: string }>("/download", { videoId }),

  getDownloadStatus: (videoId: string) =>
    get<{
      status: "not_started" | "pending" | "downloading" | "done" | "error";
    }>(`/download/${videoId}/status`),

  deleteDownload: (videoId: string) =>
    del<{ ok: boolean }>(`/download/${videoId}`),

  getDownloads: () =>
    get<{ ids: string[]; count: number; sizeBytes: number }>("/downloads"),

  clearDownloads: () => post("/downloads/clear", {}),

  lastfmNowPlaying: (data: {
    sessionKey: string;
    artist: string;
    track: string;
    album?: string;
    duration?: number;
    apiKey?: string;
    apiSecret?: string;
  }) => post("/lastfm/now-playing", data),

  lastfmScrobble: (data: {
    sessionKey: string;
    artist: string;
    track: string;
    album?: string;
    duration?: number;
    timestamp: number;
    apiKey?: string;
    apiSecret?: string;
  }) => post("/lastfm/scrobble", data),

  discordActivity: (data: {
    title: string;
    artist: string;
    album?: string;
    thumbnail?: string;
    startTimestamp?: number;
  }) => post("/discord/activity", data),

  discordClear: () => post("/discord/clear", {}),
};

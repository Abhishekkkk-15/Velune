let rpc: any = null
let connected = false
let currentClientId: string | null = null

async function getClient(clientId?: string): Promise<any> {
  const id = clientId || process.env.DISCORD_CLIENT_ID || ''
  if (!id) return null

  if (connected && rpc && id === currentClientId) return rpc

  if (rpc) {
    try { await rpc.destroy() } catch {}
    rpc = null
    connected = false
  }

  try {
    const { default: DiscordRPC } = await import('discord-rpc')
    DiscordRPC.register(id)
    const client = new DiscordRPC.Client({ transport: 'ipc' })
    await client.login({ clientId: id })
    rpc = client
    connected = true
    currentClientId = id
    rpc.on('disconnected', () => {
      connected = false
      rpc = null
      currentClientId = null
    })
    return rpc
  } catch {
    return null
  }
}

export async function setDiscordActivity(track: {
  title: string
  artist: string
  album?: string
  thumbnail?: string
  startTimestamp?: number
  clientId?: string
}) {
  const client = await getClient(track.clientId)
  if (!client) return

  try {
    await client.setActivity({
      details: track.title,
      state: track.artist,
      largeImageKey: track.thumbnail || 'velune_logo',
      largeImageText: track.album || track.title,
      smallImageKey: 'play',
      smallImageText: 'Velune',
      startTimestamp: track.startTimestamp || Date.now(),
      buttons: [
        { label: 'Listen on YouTube Music', url: 'https://music.youtube.com/' },
      ],
    })
  } catch {}
}

export async function clearDiscordActivity(clientId?: string) {
  const client = await getClient(clientId)
  if (!client) return
  try { await client.clearActivity() } catch {}
}

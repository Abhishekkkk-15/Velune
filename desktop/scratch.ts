import nodeFetch from 'node-fetch'
import spotifyUrlInfo from 'spotify-url-info'

const { getTracks } = spotifyUrlInfo(nodeFetch)

async function test() {
  const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'; // Today's Top Hits
  const tracks = await getTracks(url);
  console.log(JSON.stringify(tracks.slice(0, 2), null, 2));
}

test().catch(console.error);

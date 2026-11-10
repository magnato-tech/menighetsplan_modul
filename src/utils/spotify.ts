// The Spotify player on the website. A talk can have a link to Spotify, and the website shows the
// player inside the page. Only Spotify's own player is put in the page: an address from anywhere
// else would be shown as part of the congregation's website.

const SPOTIFY_ITEM = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(episode|show|track|album|playlist)\/([A-Za-z0-9]+)(?:[/?#].*)?$/;

/** The address of Spotify's player for a link to an episode, show, track, album or playlist; null for anything else. */
export function spotifyEmbedUrl(url: string | undefined): string | null {
  const match = SPOTIFY_ITEM.exec((url ?? "").trim());
  return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}` : null;
}

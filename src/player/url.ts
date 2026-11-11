/**
 * Normaliza una URL de entrada antes de pasarla al reproductor.
 *
 * Reglas (sin cambios de comportamiento respecto a la versión original de `play.ts`):
 * - YouTube Music (`music.youtube.com/watch?v=...`) -> YouTube regular, preservando `list=`.
 * - Playlists de YouTube/YouTube Music -> URL limpia de playlist.
 * - Enlaces cortos `youtu.be/<id>` -> `watch?v=<id>`.
 * - Vídeos de YouTube sin `list=` -> URL limpia sin parámetros extra.
 * - SoundCloud -> URL sin query string.
 * - Cualquier otra cosa se devuelve tal cual (búsquedas de texto, Spotify, etc.).
 */
export function normalizeUrl(url: string): string {
  // YouTube Music -> YouTube regular (preserva list= si es playlist/mix)
  const ytmusicMatch = url.match(/music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (ytmusicMatch) {
    const listPart = url.match(/&list=([a-zA-Z0-9_-]+)/)?.[1];
    const v = `https://www.youtube.com/watch?v=${ytmusicMatch[1]}`;
    return listPart ? `${v}&list=${listPart}` : v;
  }
  // YouTube Playlist (incluye YouTube Music) -> URL limpia de playlist
  const playlistMatch = url.match(/(?:music\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch) {
    return `https://www.youtube.com/playlist?list=${playlistMatch[1]}`;
  }
  // YouTube Video con parametros extra -> URL limpia
  const ytbeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (ytbeMatch) {
    return `https://www.youtube.com/watch?v=${ytbeMatch[1]}`;
  }
  // YouTube Video sin playlist -> URL limpia (sin parametros extra)
  const ytwatchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (ytwatchMatch && !url.includes('list=')) {
    return `https://www.youtube.com/watch?v=${ytwatchMatch[1]}`;
  }
  // SoundCloud -> limpiar query parameters
  // No se convierte a on.soundcloud.com: los slugs no son tokens válidos para esa forma
  const soundcloudMatch = url.match(/https?:\/\/soundcloud\.com\/[^?]+/);
  if (soundcloudMatch) {
    return soundcloudMatch[0];
  }
  return url;
}

/**
 * @file src/assets/assetUrls.js
 * Central registry of branded CDN-hosted image URLs for NEXORA-MD.
 *
 * Every visual surface in the bot (menu banners, welcome/goodbye cards,
 * ad-reply thumbnails, document cards, interactive menus) references these
 * URLs via WhatsApp's externalAdReply `thumbnailUrl` field — the link-preview
 * format. This means:
 *
 *   • No image files stored locally — zero disk I/O, zero BMP generation,
 *     zero "file not found" fallbacks to null.
 *   • WhatsApp servers fetch and cache the thumbnail from the URL, so it
 *     renders even if the bot's own filesystem is ephemeral (Railway, Render).
 *   • Updating a visual is a one-line change here, not a re-deploy.
 *
 * If an owner sets a custom image via `!setwelcomeimage` etc., the manual
 * override (stored in the database) takes priority over these defaults.
 */

// ── Branded visual URLs (CDN-hosted, publicly accessible) ────────────────────
// Horror-cinematic brand set v2, hosted in this repo under media/brand/ and
// served via jsDelivr. The bot name in the path is the repository name.
export const ASSET_URLS = {
  // Square logo / thumbnail — used in ad-reply cards, about, version, etc.
  thumbnail:
    'https://cdn.jsdelivr.net/gh/boyde1317-byte/NexoraFlex@main/media/brand/nexora-logo.jpg',

  // Wide menu banner — 16:9, used by all menu styles that need a header image
  menuBanner:
    'https://cdn.jsdelivr.net/gh/boyde1317-byte/NexoraFlex@main/media/brand/nexora-banner.jpg',

  // Welcome greeting image — 16:9, glass skyscraper entrance, light and fog
  welcome:
    'https://cdn.jsdelivr.net/gh/boyde1317-byte/NexoraFlex@main/media/brand/nexora-welcome.jpg',

  // Goodbye greeting image — 16:9, lone figure on a foggy modern city street
  goodbye:
    'https://cdn.jsdelivr.net/gh/boyde1317-byte/NexoraFlex@main/media/brand/nexora-goodbye.jpg',

  // Document thumbnail — same square logo, used for document-style cards
  docThumbnail:
    'https://cdn.jsdelivr.net/gh/boyde1317-byte/NexoraFlex@main/media/brand/nexora-logo.jpg',
};

export default ASSET_URLS;

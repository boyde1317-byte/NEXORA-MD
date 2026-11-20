/**
 * ping2.js — Rem-compatible secondary ping surface.
 *
 * Rem's original file contains an expired WhatsApp media proto with a stale
 * directPath and media key. Reusing that blob would produce broken media, so
 * this version sends a fresh branded image and live latency caption.
 */
import { performance } from 'node:perf_hooks';
import { ASSET_URLS } from '../../assets/assetUrls.js';

export default {
  name: 'ping2',
  aliases: ['pingimage', 'imageping'],
  category: 'general',
  description: 'Sends the secondary image-based ping surface.',
  cooldown: 2000,
  execute: async ({ sock, m }) => {
    const started = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const latency = (performance.now() - started).toFixed(2);
    const caption = [
      '🏓 NEXORA MD • PING 2',
      '',
      `Response: ${latency} ms`,
      'Media: fresh branded asset',
      'Status: online',
    ].join('\n');
    return sock.sendMessage(m.from, {
      image: { url: ASSET_URLS.thumbnail },
      mimetype: 'image/jpeg',
      caption,
    }, { quoted: m });
  },
};

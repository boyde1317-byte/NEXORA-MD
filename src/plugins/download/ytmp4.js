import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { youtubeSearch, youtubeDownload, isUrl } from '../../lib/downloader.js';

const MAX_RESULTS = 5;

export default {
  name: 'ytmp4',
  aliases: ['ytv', 'youtube'],
  category: 'download',
  description: 'Search & download YouTube video. Usage: .ytmp4 <search or YouTube URL>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(
        `Usage: \`${prefix}ytmp4 <search or YouTube URL>\`\n\nExample: \`${prefix}ytmp4 https://youtu.be/dQw4w9WgXcQ\``,
        'YOUTUBE VIDEO'
      );
    }

    await withReactionStatus(m, async () => {
      if (isUrl(query)) {
        const data = await youtubeDownload(query);
        if (!data.mp4) throw new Error('No video stream available for that link.');

        // The backend's mp4 link is a short-lived signed CDN URL — it can already
        // be expired/dead by the time we hand it to sock.sendMessage, which then
        // surfaces an opaque "Failed to fetch stream from <url>" error. Probe it
        // first so we can retry once against a fresh link instead of failing.
        const streamIsLive = async (url) => {
          try {
            const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
            return res.ok;
          } catch (_) {
            return false;
          }
        };

        let videoUrl = data.mp4;
        if (!(await streamIsLive(videoUrl))) {
          const retry = await youtubeDownload(query).catch(() => null);
          if (retry?.mp4 && (await streamIsLive(retry.mp4))) {
            videoUrl = retry.mp4;
          } else {
            throw new Error('The video stream link expired before it could be sent. Please try again.');
          }
        }

        await sock.sendMessage(m.from, {
          video: { url: videoUrl },
          caption: `🎬 *${data.title}*\n👤 ${data.author || 'Unknown'}`,
        }, { quoted: m });
        return await mixedCard(sock, m.from, {
          text: 'Need it as audio instead?',
          footer: 'NEXORA-MD • YouTube Video',
        }, [
          { kind: 'action', label: '🎵 Get Audio', cmd: `${prefix}play ${query}` },
        ], { quoted: m });
      }

      const results = (await youtubeSearch(query)).slice(0, MAX_RESULTS);
      const cards = results.map((v, idx) => ({
        caption: `🎬 *${v.title}*\n👤 ${v.author || 'Unknown'}\n⏱️ ${v.duration || '—'}`,
        footer: `Result ${idx + 1} of ${results.length}`,
        nativeFlow: [{ text: '🎬 Download Video', id: `${prefix}ytmp4 ${v.url}` }],
        ...(v.thumbnail ? { image: { url: v.thumbnail } } : {}),
      }));

      try {
        await baileysBridge.sendCarousel(sock, m.from, {
          text: `🔎 *Top results for:* "${query}"\nTap a card's button to download.`,
          cards,
        }, { quoted: m });
      } catch (err) {
        console.warn('[ytmp4] carousel failed, falling back to select menu:', err.message);
        const { selectMenu } = await import('../lib/interactiveKit.js');
        await selectMenu(sock, m.from, { text: `🔎 Results for "${query}":` }, '🎬 Pick a video', [{
          title: 'Search Results',
          rows: results.map((v, idx) => ({
            id: `${prefix}ytmp4 ${v.url}`,
            title: `${idx + 1}. ${v.title}`.slice(0, 60),
            description: v.author || '',
          })),
        }], [], { quoted: m });
      }
    });
  }
};

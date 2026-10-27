import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard, selectMenu } from '../../lib/interactiveKit.js';
import { youtubeSearch, youtubeDownload, isUrl } from '../../lib/downloader.js';
import { DownloadProgress } from '../../lib/progress.js';

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
        const progress = new DownloadProgress(sock, m.from, m);
        await progress.start('Downloading video');
        try {
          const data = await youtubeDownload(query, { preferMp4: true });
          if (!data.mp4) throw new Error('No video stream available for that link.');

          // Probe the stream URL to catch expired CDN links before sending,
          // and read its size: there was no ceiling at all, so a long video
          // failed deep inside the upload with an opaque baileys error.
          const MAX_VIDEO_BYTES = 64 * 1024 * 1024; // WhatsApp-friendly ceiling
          const probe = async (url) => {
            try {
              const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
              if (!res.ok) return { live: false, bytes: 0 };
              return { live: true, bytes: Number(res.headers.get('content-length') || 0) };
            } catch (_) {
              return { live: false, bytes: 0 };
            }
          };

          let videoUrl = data.mp4;
          const head = await probe(videoUrl);
          if (head.live && head.bytes > MAX_VIDEO_BYTES) {
            throw new Error(`That video is ${(head.bytes / 1024 / 1024).toFixed(0)} MB — too heavy to send over WhatsApp. Try \`${prefix}play\` for the audio, or a shorter link.`);
          }
          if (!head.live) {
            const retry = await youtubeDownload(query, { preferMp4: true }).catch(() => null);
            const retryHead = retry?.mp4 ? await probe(retry.mp4) : { live: false };
            if (retryHead.live) {
              videoUrl = retry.mp4;
            } else {
              throw new Error('The video stream link expired before it could be sent. Please try again.');
            }
          }

          await progress.done(`✅ ${data.title || 'Video downloaded'}!`);

          const meta = [
            `🎬 *${data.title || 'YouTube Video'}*`,
            data.author ? `👤 ${data.author}` : null,
          ].filter(Boolean).join('\n');

          await sock.sendMessage(m.from, {
            video: { url: videoUrl },
            caption: meta,
          }, { quoted: m });
          return await mixedCard(sock, m.from, {
            text: 'Need it as audio instead?',
            footer: 'NEXORA-MD • YouTube Video',
          }, [
            { kind: 'action', label: '🎵 Get Audio',     cmd: `${prefix}play ${query}` },
            { kind: 'action', label: '🎬 Download Another',cmd: `${prefix}ytmp4` },
          ], { quoted: m });
        } catch (err) {
          await progress.fail(`Download failed: ${err.message}`);
          throw err;
        }
      }

      // Search mode
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start(`Searching YouTube for "${query}"`);
      try {
        const results = (await youtubeSearch(query)).slice(0, MAX_RESULTS);
        await progress.done(`✅ Found ${results.length} results.`);

        // NOTE: carouselMessage (baileysBridge.sendCarousel) is NOT used here —
        // relayMessage resolves successfully even when the recipient's WA
        // client can't render carouselMessage, so a try/catch around
        // sendCarousel never actually catches the failure (it shows up as
        // "your version of WhatsApp doesn't support it" on their screen).
        // selectMenu (buttonsMessage + single_select) is the reliable path.
        // High-quality display image: first result's YouTube thumbnail
        // (hq720) as the card header, with its title as the header caption.
        // If it's missing, selectMenu falls back to the menu brand image.
        const top = results[0] || {};
        await selectMenu(sock, m.from, {
          text: `🔎 Results for "${query}":`,
          title: (top.title || '').slice(0, 60) || 'YouTube Search',
          subtitle: [top.author, top.duration].filter(Boolean).join(' • '),
          thumbnail: top.thumbnail,
        }, '🎬 Pick a video', [
          {
            title: '🎬 Download Video',
            rows: results.map((v, idx) => ({
              id: `${prefix}ytmp4 ${v.url}`,
              title: `${idx + 1}. ${v.title}`.slice(0, 60),
              description: `${v.author || ''} • ${v.duration || ''}`,
            })),
          },
          {
            title: '🎵 Download Audio',
            rows: results.map((v, idx) => ({
              id: `${prefix}play ${v.url}`,
              title: `${idx + 1}. ${v.title}`.slice(0, 60),
              description: `${v.author || ''} • ${v.duration || ''}`,
            })),
          },
        ], [], { quoted: m });
      } catch (err) {
        await progress.fail(`Search failed: ${err.message}`);
        throw err;
      }
    });
  }
};

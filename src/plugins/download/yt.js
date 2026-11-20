/**
 * yt.js — YouTube audio/video downloader (LUNA play.js port).
 *
 *   .yt <query|url>        audio (mp3) of the top search result
 *   .ytaudio <query|url>   same as .yt
 *   .ytvideo <query|url>   video (mp4) of the top search result
 *
 * Ported from the LUNA MD play.js plugin. NexoraFlex already ships
 * .play (aliases yta/ytmp3/...) and .ytmp4 (aliases ytv/youtube), so
 * this variant is .yt / .ytaudio / .ytvideo and never shadows them.
 * The LUNA alternative command names yt/ytaudio/ytvideo are used here
 * exactly as specified; play/ytmp3/ytmp4 are NOT taken.
 *
 * Differences from the LUNA MD original (luna-md/plugins/play.js):
 *   - The LUNA download stack is gone: axios, yt-search, the savetube
 *     AES helper (with its hardcoded secret key), the SaveNow API key,
 *     and the ytdlpyton/ytdown backends are not available in NexoraFlex
 *     (no axios or yt-search in package.json). Downloads go through the
 *     house lib/downloader.js instead — youtubeSearch for lookup,
 *     youtubeAudioBuffer for audio, youtubeDownload for video — the same
 *     helpers the house .play / .ytmp4 use.
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; the audio/video choice
 *     comes from the ctx `commandName` instead of the LUNA command regex.
 *   - Search mode takes the top result directly (as LUNA did) instead of
 *     opening the house selectMenu picker.
 *   - Video sends keep the house 64 MB ceiling: oversized results are
 *     refused with a plain error instead of failing mid-upload.
 *   - The hardcoded SaveNow API key and savetube secret key from the
 *     LUNA source are NOT carried over (they were third-party service
 *     credentials baked into the plugin).
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import {
  youtubeSearch,
  youtubeAudioBuffer,
  youtubeDownload,
  whatsappAudioBuffer,
  isUrl,
} from '../../lib/downloader.js';

const MAX_VIDEO_BYTES = 64 * 1024 * 1024;

async function sendAudio({ sock, m, url, prefix }) {
  const audio = await youtubeAudioBuffer(url);
  const metaParts = [
    `🎵 *${audio.title || 'YouTube Audio'}*`,
    audio.author ? `👤 ${audio.author}` : null,
    audio.duration ? `⏱️ ${audio.duration}` : null,
  ].filter(Boolean).join('\n');

  const playable = await whatsappAudioBuffer(audio.buffer, audio.mimetype);

  await sock.sendMessage(m.from, {
    audio: playable.buffer,
    mimetype: playable.mimetype,
    ptt: false,
  }, { quoted: m });

  return metaParts;
}

async function sendVideo({ sock, m, url }) {
  const data = await youtubeDownload(url, { preferMp4: true });
  if (!data.mp4) throw new Error('No video stream available for that link.');

  let videoUrl = data.mp4;
  const probe = async (target) => {
    try {
      const res = await fetch(target, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { live: false, bytes: 0 };
      return { live: true, bytes: Number(res.headers.get('content-length') || 0) };
    } catch (_) {
      return { live: false, bytes: 0 };
    }
  };

  const head = await probe(videoUrl);
  if (head.live && head.bytes > MAX_VIDEO_BYTES) {
    throw new Error(`That video is ${(head.bytes / 1024 / 1024).toFixed(0)} MB — too heavy to send over WhatsApp. Try \`.yt\` for the audio, or a shorter link.`);
  }
  if (!head.live) {
    const retry = await youtubeDownload(url, { preferMp4: true }).catch(() => null);
    const retryHead = retry?.mp4 ? await probe(retry.mp4) : { live: false };
    if (retryHead.live) videoUrl = retry.mp4;
    else throw new Error('The video stream link expired before it could be sent. Please try again.');
  }

  const meta = [
    `🎬 *${data.title || 'YouTube Video'}*`,
    data.author ? `👤 ${data.author}` : null,
  ].filter(Boolean).join('\n');

  await sock.sendMessage(m.from, {
    video: { url: videoUrl },
    caption: meta,
  }, { quoted: m });
}

export default {
  name: 'yt',
  aliases: ['ytaudio', 'ytvideo'],
  category: 'download',
  description: 'Download YouTube audio (.yt / .ytaudio) or video (.ytvideo) by search or link.',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const command = String(commandName || 'yt').toLowerCase();
    const isVideo = command === 'ytvideo';
    const q = args.join(' ').trim();

    if (!q) {
      return m.reply(
        `*Example:*\n${p}${command} https://youtu.be/xxx\n${p}${command} latest dj`
      );
    }

    await withReactionStatus(m, async () => {
      await sock.sendMessage(m.from, { react: { text: '🕕', key: m.key } });
      try {
        let url = q;
        if (!isUrl(q)) {
          const results = await youtubeSearch(q);
          if (!results.length) return m.reply(`❌ Not found: ${q}`);
          url = results[0].url;
        }
        if (isVideo) {
          await sendVideo({ sock, m, url });
        } else {
          await sendAudio({ sock, m, url, prefix: p });
        }
        await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
      } catch (e) {
        await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        await m.reply(`❌ ${isVideo ? 'Download failed' : 'Error'}: ${e.message}`);
      }
    });
  },
};

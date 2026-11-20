/**
 * funpack.js — .funpack <brat|meme|ai|spotify> ... — fun grab-bag.
 *
 * Ported from luna-md/plugins/fun.js. ADAPTATION: the LUNA original
 * registered the bare commands brat / meme / ai / gpt / openai / spotify,
 * but every one of those names (or an alias) already exists in NexoraFlex,
 * so this port has NO aliases and dispatches on a subcommand instead:
 *
 *   .funpack brat <text>        brat-style sticker (brat.siputzx.my.id)
 *   .funpack meme <top>|<bottom>  meme image (memegen.link)
 *   .funpack ai <question>      quick AI answer (siputzx GPT)
 *   .funpack spotify <track url>  Spotify track as audio (siputzx)
 *
 * The original's `alya` helper relayed a bare interactiveMessage with an
 * inapp_signup button as its text channel; that is replaced with plain
 * m.reply / sock.sendMessage. All user-facing strings rebranded
 * LUNA MD -> NEXORA MD. Uses global fetch (no node-fetch in NX deps).
 */

async function fetchJson(url, timeoutMs = 20000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  return res.json();
}

export default {
  name: 'funpack',
  aliases: [],
  category: 'fun',
  description: 'Fun grab-bag: brat stickers, memes, quick AI answers, Spotify downloads. Usage: .funpack <brat|meme|ai|spotify> ...',
  cooldown: 3000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const sub = (args[0] || '').toLowerCase();
    const rest = args.slice(1).join(' ').trim();
    const usage = [
      '🎲 *FUNPACK* — pick one:',
      '',
      `• ${p}funpack brat <text> — brat sticker`,
      `• ${p}funpack meme <top>|<bottom> — meme image`,
      `• ${p}funpack ai <question> — quick AI answer`,
      `• ${p}funpack spotify <track url> — Spotify audio`,
    ].join('\n');

    if (sub === 'brat') {
      if (!rest) return await m.reply(`Example: ${p}funpack brat hello`);
      await m.reply('⏳ Making brat sticker...');
      const res = await fetch(`https://brat.siputzx.my.id/api/brat?text=${encodeURIComponent(rest)}`, { signal: AbortSignal.timeout(20000) });
      const buf = Buffer.from(await res.arrayBuffer());
      return await sock.sendMessage(m.from, { sticker: buf }, { quoted: m });
    }

    if (sub === 'meme') {
      const [top, bottom] = rest.split('|');
      if (!top) return await m.reply(`Example: ${p}funpack meme top text|bottom text`);
      const link = `https://api.memegen.link/images/custom/${encodeURIComponent(top.trim())}/${encodeURIComponent((bottom || ' ').trim())}.png?background=https://i.imgflip.com/1bij.jpg`;
      return await sock.sendMessage(m.from, { image: { url: link }, caption: 'NEXORA MD' }, { quoted: m });
    }

    if (sub === 'ai' || sub === 'gpt') {
      if (!rest) return await m.reply('Ask something...');
      await m.reply('⏳ NEXORA MD is thinking...');
      let ans = null;
      try {
        const r = await fetchJson(`https://api.siputzx.my.id/api/ai/gpt?text=${encodeURIComponent(rest)}`);
        ans = r?.result || r?.data || null;
      } catch (_) {}
      if (ans) return await m.reply(`${ans}\n\nNEXORA MD`);
      return await m.reply('AI error\n\nNEXORA MD');
    }

    if (sub === 'spotify') {
      const url = args[1] || '';
      if (!url) return await m.reply(`Example: ${p}funpack spotify https://open.spotify.com/track/xxx`);
      await m.reply('⏳ Downloading Spotify...');
      const r = await fetchJson(`https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`);
      const link = r?.data?.url || r?.result?.download || null;
      if (link) return await sock.sendMessage(m.from, { audio: { url: link }, mimetype: 'audio/mpeg' }, { quoted: m });
      return await m.reply('❌ Could not download that Spotify track.');
    }

    return await m.reply(usage);
  },
};

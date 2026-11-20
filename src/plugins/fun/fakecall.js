/**
 * fakecall.js — .fakecall / .fakecall-ios <name> | <duration> — make a
 * fake incoming-call screenshot (Android or iPhone style).
 *
 * Ported from LUNA MD plugins/fakecall.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - No axios / form-data (NexoraFlex has neither): plain `fetch`
 *     with the native `FormData` + `Blob` for the avatar upload, and
 *     `fetch` for the profile-picture / fallback-avatar downloads.
 *   - The avatar comes from the replied image, the command message's
 *     own image, the sender's profile picture, or the fallback avatar
 *     URL, in that order — same as the original.
 *   - Aliases cover the original regex:
 *     /^(fakecall|fakecall-android|fakecall-ios|fakecallwa)$/i.
 */
const FALLBACK_AVATAR = 'https://files.catbox.moe/nwvkbt.png';

export default {
  name: 'fakecall',
  aliases: ['fakecall-android', 'fakecall-ios', 'fakecallwa'],
  category: 'fun',
  description: 'Make a fake incoming-call image. Usage: .fakecall <name> | <duration> (reply to an image for the avatar)',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = (commandName || 'fakecall').toLowerCase();
    const text = (args || []).join(' ').trim();
    if (!text || !text.includes('|')) {
      let helpText = 'Hello! Wrong format.\n\n';
      helpText += '*Command list:*\n';
      helpText += `- *${prefix}fakecall* (Android)\n`;
      helpText += `- *${prefix}fakecall-ios* (iPhone)\n\n`;
      helpText += '*How to use:*\n';
      helpText += 'Type Name | Duration\n\n';
      helpText += '*Example:*\n';
      helpText += `- *${prefix}fakecall Zann | 03:33:33*\n`;
      helpText += `- *${prefix}fakecall-ios Sayangku | 12:00:00*\n\n`;
      helpText += '*Tip:* Reply to an image to use it as the caller\'s avatar!';
      return m.reply(helpText);
    }
    const [nama, durasi] = text.split('|').map((s) => s.trim());
    if (!nama) return m.reply('❌ Name cannot be empty!');
    if (!durasi) return m.reply('❌ Duration cannot be empty!');
    await sock.sendMessage(m.from, { react: { text: '🕕', key: m.key } });
    try {
      let bufferBase;
      if (m.quoted && m.quoted.mtype && m.quoted.mtype.includes('image')) {
        try { bufferBase = await m.quoted.download(); } catch (_) {}
      } else if (m.mtype && m.mtype.includes('image')) {
        try { bufferBase = await m.download(); } catch (_) {}
      }
      if (!bufferBase) {
        try {
          const ppUrl = await sock.profilePictureUrl(m.sender, 'image');
          const res = await fetch(ppUrl, { signal: AbortSignal.timeout(15000) });
          bufferBase = Buffer.from(await res.arrayBuffer());
        } catch (_) {
          const res = await fetch(FALLBACK_AVATAR, { signal: AbortSignal.timeout(15000) });
          bufferBase = Buffer.from(await res.arrayBuffer());
        }
      }
      const form = new FormData();
      form.append('avatarUrl', new Blob([bufferBase], { type: 'image/jpeg' }), 'avatar.jpg');
      form.append('name', nama);
      form.append('duration', durasi);
      let endpoint = 'fakecall-android';
      if (cmd === 'fakecall-ios' || cmd === 'fakecallwa-ios') endpoint = 'fakecall-ios';
      const apiUrl = `https://my.izuka-api.xyz/api/canvas/${endpoint}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const image = Buffer.from(await response.arrayBuffer());
      await sock.sendMessage(m.from, { image, caption: `✅ Fake call: ${nama} | ${durasi}` }, { quoted: m });
      await sock.sendMessage(m.from, { react: { text: '📞', key: m.key } });
    } catch (err) {
      console.error('[fakecall]', err);
      await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
      return m.reply(`❌ Failed to create fake call: ${err.message}`);
    }
  },
};

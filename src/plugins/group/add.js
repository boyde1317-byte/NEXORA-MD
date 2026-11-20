/**
 * add.js — .add <number|@user|reply> — add a user to the group.
 *
 * Ported from luna-md/plugins/group-manage.js, `add` branch ONLY
 * (kick / promote / demote / mute / unmute / opengc / closegc all exist
 * in NexoraFlex already).
 *
 * BUG FIX: the original referenced a free variable `conn` that it never
 * destructured, so the add branch would throw on every call. All socket
 * calls here use the execute-context `sock`.
 *
 * Invite flow kept from the original: when WhatsApp answers 403 (user
 * cannot be added directly) the returned invite code is sent as a
 * group V4 invite. The group picture thumbnail is fetched to a buffer
 * first; if that fails the invite is sent without a thumbnail.
 */

export default {
  name: 'add',
  aliases: [],
  category: 'group',
  description: 'Add a user to the group (reply, mention, or give a number). Usage: .add <number>',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    let target = '';
    if (m.quoted?.sender) {
      target = m.quoted.sender;
    } else if (m.msg?.contextInfo?.mentionedJid?.length) {
      target = m.msg.contextInfo.mentionedJid[0];
    } else if (args[0]) {
      const cleanNum = args[0].replace(/[^0-9]/g, '');
      if (cleanNum) target = `${cleanNum}@s.whatsapp.net`;
    }
    if (!target) {
      return await m.reply.error('Reply to or tag the user you want to add, or give their number.\n\nExample: .add 233123456789');
    }

    const meta = await sock.groupMetadata(m.from).catch(() => null);
    if (!meta) return await m.reply.error('Could not read the group member list.');
    const inGc = meta.participants.some((v) => v.id === target);
    if (inGc) return await m.reply.error('User is already in the group!');

    const response = await sock.groupParticipantsUpdate(m.from, [target], 'add');

    // Group picture as the invite thumbnail (buffer); optional.
    let jpegThumbnail;
    try {
      const ppUrl = await sock.profilePictureUrl(m.from, 'image');
      if (ppUrl) {
        const res = await fetch(ppUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) jpegThumbnail = Buffer.from(await res.arrayBuffer());
      }
    } catch (_) {
      jpegThumbnail = undefined;
    }

    for (const participant of response || []) {
      const jid = participant?.content?.attrs?.phone_number || participant?.content?.attrs?.jid || target;
      const num = String(jid).split('@')[0];
      const status = participant?.status;

      if (status === '408') {
        await sock.sendMessage(m.from, {
          text: `Could not add @${num}!\nMaybe @${num} just left this group or was kicked.`,
          mentions: [jid],
        }, { quoted: m });
      } else if (status === '403') {
        const inviteCode = participant?.content?.content?.[0]?.attrs?.code;
        const inviteExp = participant?.content?.content?.[0]?.attrs?.expiration;
        if (!inviteCode) {
          await sock.sendMessage(m.from, {
            text: `Could not add @${num} — WhatsApp refused and gave no invite code.`,
            mentions: [jid],
          }, { quoted: m });
          continue;
        }
        await sock.sendMessage(m.from, {
          text: `Inviting @${num} using an invite...`,
          mentions: [jid],
        }, { quoted: m });
        const inviteArgs = [m.from, jid, inviteCode, inviteExp, meta.subject || 'WhatsApp group', 'Invitation to join my WhatsApp group'];
        if (jpegThumbnail) inviteArgs.push(jpegThumbnail);
        await sock.sendGroupV4Invite(...inviteArgs);
      }
    }
  },
};

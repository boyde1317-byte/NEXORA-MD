/**
 * timeout.js — Temporarily lock a group to admin-only mode.
 *
 * .timeout @user 5m    — Lock the group for 5 minutes
 * .timeout @user 1h    — Lock the group for 1 hour
 * .timeout @user 30s    — Lock the group for 30 seconds
 *
 * Requires admin or owner. WhatsApp does not provide a reliable per-user
 * send restriction here, so this command temporarily switches the entire
 * group to admin-only mode and restores the original setting on expiry.
 *
 * UX: Fixed broken implementation that demoted users instead of muting.
 * Now properly saves/restores group state and tracks active timeouts.
 */
import { resolveDisplayIdentity, mentionChip } from '../../lib/identity.js';
import { mixedCard } from '../../lib/interactiveKit.js';

// Track active timeouts per group so we can restore settings properly
const activeTimeouts = new Map(); // groupJid → { targetJid, targetNum, timer, previousSetting }

function parseDuration(input) {
  const match = input?.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
  }
  return null;
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export default {
  name: 'timeout',
  aliases: ['muteuser', 'tempmute', 'shh'],
  category: 'group',
  description: 'Temporarily lock the group to admins. Usage: .timeout @user <duration> (e.g. 5m, 1h, 30s)',
  cooldown: 3000,
  groupOnly: true,
  adminOnly: true,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';

    // Determine target
    let targetJid = null;
    if (m.quoted?.sender) {
      targetJid = m.quoted.sender;
    } else if (m.msg?.contextInfo?.mentionedJid?.length) {
      targetJid = m.msg.contextInfo.mentionedJid[0];
    }

    if (!targetJid) {
      return await m.reply.info(
        `Usage: \`${p}timeout @user <duration>\`\n\nExamples:\n• \`${p}timeout @user 5m\`\n• \`${p}timeout @user 1h\`\n• Reply to a message: \`${p}timeout 10m\``,
        'TIMEOUT'
      );
    }

    // Find duration arg (could be 2nd arg if @mention is 1st, or 1st if replying)
    let durationArg = null;
    for (const arg of args) {
      if (parseDuration(arg)) {
        durationArg = arg;
        break;
      }
    }

    if (!durationArg) {
      return await m.reply.error(
        `Please specify a duration. Examples: \`5m\`, \`1h\`, \`30s\`\n\nUsage: \`${p}timeout @user 5m\``
      );
    }

    const durationMs = parseDuration(durationArg);

    // Prevent timing out yourself or the bot
    if (targetJid === m.sender) {
      return await m.reply.error('You cannot timeout yourself!');
    }

    const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    if (targetJid === botJid) {
      return await m.reply.error('I cannot timeout myself!');
    }

    // Check if target is an admin
    try {
      const metadata = await sock.groupMetadata(m.from);
      const target = metadata.participants.find(p => p.id === targetJid);
      if (target?.admin === 'admin' || target?.admin === 'superadmin') {
        return await m.reply.error('Cannot timeout an admin!');
      }
    } catch (_) {}

    // ── Do not silently replace an active group-wide lock.
    if (activeTimeouts.has(m.from)) {
      return await m.reply.error('This group is already locked by an active timeout. Use `.unmute` or wait for it to expire.');
    }

    // ── Apply a group-wide restriction: switch to admin-only mode.
    let previousSetting = 'not_announcement'; // assume open by default
    try {
      const metadata = await sock.groupMetadata(m.from);
      previousSetting = metadata.announce ? 'announcement' : 'not_announcement';
    } catch (_) {}

    try {
      await sock.groupSettingUpdate(m.from, 'announcement');
    } catch (err) {
      return await m.reply.error(
        `Could not lock the group — I need admin privileges. ${err.message || ''}`
      );
    }

    const targetId = await resolveDisplayIdentity(sock, targetJid, m.from);
    const targetNum = targetId.number || null;
    const durationStr = formatDuration(durationMs);

    await mixedCard(sock, m.from, {
      text: `🔇 *GROUP LOCK ACTIVE*\n\n👤 Requested for: ${targetNum ? '+' + targetNum : targetId.label}\n⏰ Duration: *${durationStr}*\n\nAll non-admin members are temporarily restricted because WhatsApp applies this setting to the whole group. The original setting will be restored when the lock expires.`,
      footer: 'NEXORA • Timeout',
    }, [
      { kind: 'action', label: '🔊 Unmute Now', cmd: `${p}unmute` },
      { kind: 'action', label: 'ℹ️ Group Info', cmd: `${p}groupinfo` },
    ], { quoted: m });

    // ── Schedule automatic unmute: restore the group's previous setting
    const timer = setTimeout(async () => {
      try {
        // Restore the original group setting
        await sock.groupSettingUpdate(m.from, previousSetting);
        await sock.sendMessage(m.from, {
          text: `🔊 ${targetNum ? '+' + targetNum : activeTimeouts.get(m.from)?.targetLabel || 'The user'}'s timeout has expired. The group is back to normal.`,
        });
      } catch (_) {
        // If restore fails, try opening the group at minimum
        try {
          await sock.groupSettingUpdate(m.from, 'not_announcement');
          await sock.sendMessage(m.from, {
            text: `🔊 Timeout expired. Group reopened.`,
          });
        } catch (_) {}
      }
      activeTimeouts.delete(m.from);
    }, durationMs);

    activeTimeouts.set(m.from, { targetJid, targetNum, targetLabel: targetId.label, timer, previousSetting });
  }
};

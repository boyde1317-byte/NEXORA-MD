/**
 * userInfo.js — Enhanced user info card with interactive buttons.
 *
 * Shows detailed user profile: name, number, level, XP, coins, rank,
 * warnings, premium status, ban status, and member since date.
 */
import { db } from '../../database/db.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { getLevelProgress, rankBadge, streakEmoji, progressBar } from '../../economy/leveling.js';
import { getDisplayName } from '../../lib/displayName.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { actionCard } from '../../lib/interactiveKit.js';
import { formatDuration } from '../../lib/utils.js';

export default {
  name: 'userinfo',
  aliases: ['whoami', 'me', 'profile2'],
  category: 'utility',
  description: 'Shows your detailed user profile with stats and account info.',
  cooldown: 2000,
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';

    // Allow viewing other users: .userinfo @mention or .userinfo <number>
    let targetJid = m.sender;
    if (m.mentioned && m.mentioned.length > 0) {
      targetJid = m.mentioned[0];
    } else if (args[0] && /^\d+$/.test(args[0].replace(/[^0-9]/g, ''))) {
      targetJid = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }

    const user = db.getUser(targetJid);
    const name = await getDisplayName(sock, targetJid);
    const number = targetJid.split('@')[0].split(':')[0];
    const progress = getLevelProgress(user.xp || 0);
    const streak = user.streak || 0;
    const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    }) : 'Unknown';

    // Account age
    const accountAge = user.createdAt
      ? formatDuration(Date.now() - user.createdAt)
      : 'Unknown';

    const isOwner = (config_owner()) || false;

    const lines = [
      `👤 *${toSmallcaps('User Profile')}*`,
      ``,
      `▸ *Name*      : ${name}`,
      `▸ *Number*    : +${number}`,
      `▸ *Status*    : ${user.banned ? '🚫 Banned' : user.premium ? '⭐ Premium' : '✅ Active'}`,
      ``,
      `${'─'.repeat(22)}`,
      `📊 *${toSmallcaps('Leveling')}*`,
      ``,
      `▸ *Level*     : ${progress.level} ${rankBadge(progress.level)}`,
      `▸ *Total XP*  : ${progress.xp.toLocaleString()}`,
      `▸ *Progress*  : ${progressBar(progress.xpIntoLevel, progress.nextLevelXp - progress.currentLevelXp)}`,
      `▸ *Next lvl*  : ${progress.xpToNextLevel.toLocaleString()} XP away`,
      `▸ *Coins*     : ${(user.coins || 0).toLocaleString()} 🪙`,
      `▸ *Streak*    : ${streak} day${streak !== 1 ? 's' : ''} ${streakEmoji(streak)}`,
      ``,
      `${'─'.repeat(22)}`,
      `📋 *${toSmallcaps('Account')}*`,
      ``,
      `▸ *Member since* : ${memberSince}`,
      `▸ *Account age*  : ${accountAge}`,
      `▸ *Warnings*    : ${user.warnings || 0}/3`,
    ];

    if (user.banned) {
      lines.push(`▸ *Ban reason* : ${user.banReason || 'Not specified'}`);
    }

    if (user.lastDaily) {
      const lastDaily = new Date(user.lastDaily);
      lines.push(`▸ *Last daily* : ${lastDaily.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    }

    const text = asciiBuilder.box('User Info', lines);
    await m.reply(text);

    // Follow-up buttons
    try {
      const buttons = [
        { label: '💰 Balance', cmd: `${p}balance` },
        { label: '🏆 Leaderboard', cmd: `${p}leaderboard` },
      ];
      if (targetJid === m.sender) {
        buttons.push({ label: '🎁 Daily Reward', cmd: `${p}daily` });
      }
      await actionCard(sock, m.from, {
        text:   `${toSmallcaps('Quick Actions')}`,
        footer: `${toSmallcaps(name)} • ${toSmallcaps('Profile')}`,
      }, buttons, { quoted: m });
    } catch (_) {}
  },
};

// Helper to check owner — avoids circular import
function config_owner() {
  return false; // owner check is handled by permission system
}

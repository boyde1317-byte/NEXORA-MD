/**
 * levelup2.js — .levelup2 — check your level and XP progress.
 *
 * Ported from LUNA MD plugins/xp-levelup.js. The original ran pending
 * level-ups by hand: it looped `while (canLevelUp(...)) user.level++`
 * against lib/levelling.js xpRange() and a global multiplier.
 *
 * NexoraFlex levels up automatically — grantXp() in src/economy/leveling.js
 * bumps the level the moment XP crosses a threshold (see the message
 * handler's passive XP award). There is no pending level-up to claim, so
 * this command is a progress check, not a claim: it reads the user record
 * via db.getUser() and the level curve via getLevelProgress(user.xp).
 * Money/exp mapping: LUNA exp -> NX xp (user.xp), LUNA level -> user.level.
 *
 * Note: the house already shows level progress in economy/rank.js and
 * economy/profile.js — this is the plain-text LUNA-style check.
 */
import { getLevelProgress, progressBar, rankBadge } from '../../economy/leveling.js';
import { getDisplayName } from '../../lib/displayName.js';

export default {
  name: 'levelup2',
  aliases: [],
  category: 'economy',
  description: 'Check your level and XP progress towards the next level.',
  cooldown: 3000,
  execute: async ({ m, sock, db }) => {
    const user = db.getUser(m.sender);
    const name = await getDisplayName(sock, m.sender);
    const level = user.level ?? 0;
    const xp = user.xp ?? 0;
    const progress = getLevelProgress(xp);
    const badge = rankBadge(level);
    const bar = progressBar(progress.xpIntoLevel, progress.nextLevelXp - progress.currentLevelXp, 10);

    await m.reply(
      [
        `🎮 *${name}* — Level ${level} ${badge}`,
        `${bar}`,
        `XP: ${progress.xpIntoLevel.toLocaleString()} / ${(progress.nextLevelXp - progress.currentLevelXp).toLocaleString()} into this level`,
        `You need ${progress.xpToNextLevel.toLocaleString()} more XP to reach Level ${level + 1}!`,
        '',
        '_Levels go up automatically as you chat — no need to claim._',
      ].join('\n')
    );
  },
};

/**
 * profile.js — User profile card.
 *
 * Upgraded from asciiBuilder + plain image → richTableCard + mixedCard.
 * Profile picture is sent as image header, then richTable for stats, then
 * mixedCard with economy navigation buttons.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { richTableCard, mixedCard } from '../../lib/interactiveKit.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { getLevelProgress, progressBar, rankBadge, streakEmoji } from '../../economy/leveling.js';

export default {
  name: 'profile',
  aliases: ['prof', 'stats', 'rank', 'level', 'me'],
  category: 'economy',
  description: 'Shows your profile — level, XP, coins, streak and rank. Reply to someone or @ them to view theirs.',
  cooldown: 4000,
  execute: async ({ m, sock, db, prefix }) => {
    const p = prefix || '.';
    let targetJid = m.sender;

    if (m.quoted) {
      targetJid = m.quoted.sender;
    } else if (m.msg?.contextInfo?.mentionedJid?.length) {
      targetJid = m.msg.contextInfo.mentionedJid[0];
    }

    const number = targetJid.split('@')[0].split(':')[0];
    const isSelf = targetJid === m.sender;

    await withReactionStatus(m, async () => {
      const d = db.getUser(targetJid);

      const xp       = d.xp     ?? 0;
      const coins    = d.coins  ?? 0;
      const streak   = d.streak ?? 0;
      const progress = getLevelProgress(xp);
      const level    = progress.level;
      const bar      = progressBar(progress.xpIntoLevel, progress.nextLevelXp - progress.currentLevelXp);
      const badge    = rankBadge(level);
      const fire     = streakEmoji(streak);

      const lastDaily = d.lastDaily
        ? new Date(d.lastDaily).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Never';

      let ppUrl = null;
      try { ppUrl = await sock.profilePictureUrl(targetJid, 'image'); } catch (_) {}

      const title = isSelf ? '👤 YOUR PROFILE' : `👤 PROFILE — +${number}`;

      // ── Tier 1: profile picture + richTableCard + mixedCard ─────────────
      try {
        // Send profile picture first as visual header if available
        if (ppUrl) {
          const res = await fetch(ppUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
          if (res?.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            await sock.sendMessage(m.from, {
              image:   buffer,
              caption: `👤 *+${number}*\n${badge}  Level ${level}  •  ${fire} ${streak}-day streak`,
            }, { quoted: m });
          }
        }

        const extraRows = [
          d.premium ? ['Status',   '💎 Premium'] : null,
          d.banned  ? ['Status',   '🚫 Banned']  : null,
          d.warnings > 0 ? ['Warnings', `${d.warnings}/3 ⚠️`] : null,
        ].filter(Boolean);

        await richTableCard(sock, m.from, {
          title,
          headers: ['Field', 'Value'],
          rows: [
            ['Number',     `+${number}`],
            ['Rank',       badge],
            ['Level',      String(level)],
            ['XP',         xp.toLocaleString()],
            ['Progress',   bar],
            ['Next Level', `${progress.xpToNextLevel.toLocaleString()} XP`],
            ['Coins',      `🪙 ${coins.toLocaleString()}`],
            ['Streak',     `${fire} ${streak} day${streak !== 1 ? 's' : ''}`],
            ['Last Claim', lastDaily],
            ...extraRows,
          ],
          footer: `${isSelf ? 'Your stats' : `Stats for +${number}`} • NEXORA Economy`,
        }, { quoted: ppUrl ? undefined : m });

        if (isSelf) {
          return await mixedCard(sock, m.from, {
            text:   '📊 What would you like to do next?',
            footer: 'NEXORA Economy',
          }, [
            { kind: 'action', label: '🪙 Claim Daily',      cmd: `${p}daily` },
            { kind: 'action', label: '🏆 Leaderboard',      cmd: `${p}lb` },
            { kind: 'action', label: '🏅 Leaderboard Coins',cmd: `${p}lb coins` },
          ], { quoted: m });
        }
        return;
      } catch (err) {
        console.warn('[profile] Tier 1 (richTableCard + mixedCard) failed:', err.message);
      }

      // ── Tier 2: plain image + asciiBuilder fallback ──────────────────────
      const lines = [
        `📱 Number   : +${number}`,
        `🏅 Rank     : ${badge}`,
        ``,
        `📊 Level    : ${level}`,
        `✨ XP       : ${xp.toLocaleString()}`,
        `📈 Progress : ${bar}`,
        `   Next lvl : ${progress.xpToNextLevel.toLocaleString()} XP away`,
        ``,
        `🪙 Coins    : ${coins.toLocaleString()}`,
        `${fire} Streak  : ${streak} day${streak !== 1 ? 's' : ''}`,
        `📅 Last Claim: ${lastDaily}`,
        ``,
        d.premium ? `💎 Premium  : Active` : null,
        d.banned  ? `🚫 Status   : Banned` : null,
        d.warnings > 0 ? `⚠️  Warnings : ${d.warnings}/3` : null,
      ].filter(l => l !== null);

      const text = asciiBuilder.box(title, lines);

      if (ppUrl) {
        const res = await fetch(ppUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        if (res?.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          return await sock.sendMessage(m.from, { image: buffer, caption: text }, { quoted: m });
        }
      }

      await m.reply(text);
    });
  }
};

/**
 * leaderboard.js — Top 10 XP / Coins ranking.
 *
 * Upgraded from asciiBuilder to richTableCard + actionCard for a native,
 * polished ranking display with quick follow-up navigation.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { richTableCard, actionCard } from '../../lib/interactiveKit.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { xpToLevel, rankBadge } from '../../economy/leveling.js';

const PLACE = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export default {
  name: 'leaderboard',
  aliases: ['lb', 'top', 'topusers', 'ranking'],
  category: 'economy',
  description: 'Shows the top 10 users by XP globally. Use `!lb coins` to rank by coins instead.',
  cooldown: 5000,
  execute: async ({ m, sock, args, db, prefix }) => {
    const p     = prefix || '.';
    const mode  = args[0]?.toLowerCase() === 'coins' ? 'coins' : 'xp';
    const label = mode === 'coins' ? '🪙 Coins' : '✨ XP';

    await withReactionStatus(m, async () => {
      const allUsers = db.data?.users ?? {};
      const entries  = Object.entries(allUsers)
        .map(([jid, data]) => ({
          jid,
          number: jid.split('@')[0].split(':')[0],
          xp:     data.xp    ?? 0,
          coins:  data.coins ?? 0,
          level:  xpToLevel(data.xp ?? 0),
        }))
        .filter(u => u.xp > 0 || u.coins > 0)
        .sort((a, b) => mode === 'coins' ? b.coins - a.coins : b.xp - a.xp);

      if (entries.length === 0) {
        return await m.reply.info(
          `No one has earned ${label} yet — be the first with \`${p}daily\`!`,
          'LEADERBOARD'
        );
      }

      const top10 = entries.slice(0, 10);
      const senderNum  = m.sender.split('@')[0].split(':')[0];
      const senderRank = entries.findIndex(e => e.number === senderNum);

      // ── Tier 1: richTableCard ────────────────────────────────────────────
      try {
        const rows = top10.map((u, i) => {
          const badge  = rankBadge(u.level);
          const value  = mode === 'coins'
            ? u.coins.toLocaleString()
            : u.xp.toLocaleString();
          const isSelf = u.number === senderNum ? ' ◀' : '';
          return [
            `${PLACE[i]}`,
            `+${u.number.slice(-6)}`,
            `${badge} Lv${u.level}`,
            `${value}${isSelf}`,
          ];
        });

        let footer = `${entries.length} users ranked`;
        if (senderRank >= 10) {
          const u     = entries[senderRank];
          const value = mode === 'coins'
            ? u.coins.toLocaleString()
            : u.xp.toLocaleString();
          footer = `Your rank: #${senderRank + 1} • ${label}: ${value}`;
        }

        await richTableCard(sock, m.from, {
          title:   mode === 'coins' ? '🪙 TOP 10 — COINS LEADERBOARD' : '✨ TOP 10 — XP LEADERBOARD',
          headers: ['#', 'Number', 'Rank', label],
          rows,
          footer,
        }, { quoted: m });

        const flipMode  = mode === 'coins' ? 'xp' : 'coins';
        const flipLabel = mode === 'coins' ? '✨ Switch to XP' : '🪙 Switch to Coins';
        return await actionCard(sock, m.from, {
          text:   `Showing top ${top10.length} of ${entries.length} ranked users.`,
          footer: 'NEXORA Economy',
        }, [
          { label: flipLabel,          cmd: `${p}lb ${flipMode}` },
          { label: '👤 My Profile',    cmd: `${p}profile` },
          { label: '🪙 Claim Daily',   cmd: `${p}daily` },
        ], { quoted: m });
      } catch (err) {
        console.warn('[leaderboard] richTableCard failed, plain-text fallback:', err.message);
      }

      // ── Tier 2: asciiBuilder fallback ────────────────────────────────────
      const rows = top10.map((u, i) => {
        const badge  = rankBadge(u.level);
        const value  = mode === 'coins' ? u.coins.toLocaleString() : u.xp.toLocaleString();
        const isSelf = u.number === senderNum ? ' ← you' : '';
        return `${PLACE[i]} +${u.number.slice(-6).padStart(6)} ${badge} Lv${u.level}  ${label}: ${value}${isSelf}`;
      });

      if (senderRank >= 10) {
        const u     = entries[senderRank];
        const value = mode === 'coins' ? u.coins.toLocaleString() : u.xp.toLocaleString();
        rows.push('');
        rows.push(`— Your rank: #${senderRank + 1}  ${label}: ${value}`);
      }

      const title = mode === 'coins' ? '🪙 TOP 10 — COINS' : '✨ TOP 10 — XP';
      await m.reply(asciiBuilder.box(title, rows));
    });
  }
};

/**
 * help.js — .help — command categories as a native list card
 * (generateListContent, device-audited .testrich shape). Rows are built
 * live from the loaded plugin registry, so the card always reflects
 * reality. Fallback: plain text listing.
 */

import { client } from '../../core/client.js';
import { sendListCard } from '../../lib/richContent.js';

const CATEGORY_EMOJI = {
  general: '⚙️', download: '⬇️', ai: '🧠', web: '🌐', economy: '💰',
  fun: '🎲', group: '👥', media: '🖼️', owner: '👑', utility: '🔧',
  anime: '🌸', sticker: '✨',
};

export default {
  name: 'help',
  aliases: ['categories', 'modules'],
  category: 'general',
  description: 'Browse command categories. Usage: .help',
  cooldown: 3000,

  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';

    // Group command names by category from the live registry
    const byCat = new Map();
    for (const [name, plugin] of client.commands) {
      const cat = (plugin?.category || 'other').toLowerCase();
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(name);
    }

    if (!byCat.size) {
      return await m.reply.error('No commands are loaded. Use .menu to check the bot state.');
    }

    const rows = [...byCat.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .map(([cat, cmds]) => {
        const emoji = CATEGORY_EMOJI[cat] || '📦';
        const shown = cmds.slice(0, 4).join(', ') + (cmds.length > 4 ? `, +${cmds.length - 4}` : '');
        return [`${emoji} ${cat[0].toUpperCase() + cat.slice(1)} (${cmds.length})`, shown];
      });

    // ── Rich tier: native list card ──
    const listSent = await sendListCard(sock, m.from, m, {
      title: 'Command Categories',
      rows,
      headerText: '❖ NEXORA-MD Command Categories',
      footer: `Use ${p}menu for the full list • © NEXORA-MD by Aizen`,
    });
    if (listSent) return;

    // ── Fallback: plain text ──
    await m.reply.info(
      rows.map(([a, b]) => `▸ ${a}\n   ${b}`).join('\n\n') + `\n\nUse \`${p}menu\` for the full list.`,
      'NEXORA • Categories'
    );
  },
};

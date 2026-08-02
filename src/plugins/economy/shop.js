/**
 * shop.js — Spend coins on perks and customizations.
 *
 * Economy sink so coins have actual value. Currently offers:
 *  - Custom title (sets a display title on your profile)
 *  - Custom color theme (changes your menu accent)
 *  - XP boost (instant XP purchase)
 *  - Sticker pack slot (increases custom sticker capacity)
 *
 * Usage:
 *  .shop            — view the shop
 *  .shop buy <id>   — purchase an item
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { richTableCard, actionCard } from '../../lib/interactiveKit.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { grantXp } from '../../economy/leveling.js';

const SHOP_ITEMS = [
  { id: 'title',    name: 'Custom Title',       price: 500,  desc: 'Set a custom title on your profile' },
  { id: 'theme',    name: 'Custom Theme',        price: 1000, desc: 'Unlock a custom menu accent color' },
  { id: 'xp500',    name: '500 XP Boost',         price: 300,  desc: 'Instantly gain 500 XP' },
  { id: 'xp2000',   name: '2000 XP Boost',        price: 1000, desc: 'Instantly gain 2000 XP' },
  { id: 'stickers', name: '+5 Sticker Slots',     price: 750,  desc: 'Increase custom sticker pack capacity' },
];

export default {
  name: 'shop',
  aliases: ['store', 'buy'],
  category: 'economy',
  description: 'Spend your coins on perks. Usage: .shop to browse, .shop buy <id> to purchase.',
  cooldown: 3000,
  execute: async ({ m, sock, db, args, prefix }) => {
    const p = prefix || '.';
    const subCmd = args[0]?.toLowerCase();

    // ── Purchase flow ──────────────────────────────────────────────────
    if (subCmd === 'buy' || subCmd === 'purchase') {
      const itemId = args[1]?.toLowerCase();
      const item = SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) {
        return await m.reply.error(
          `Unknown item. Available: ${SHOP_ITEMS.map(i => i.id).join(', ')}\n\nType \`${p}shop\` to see the full list.`
        );
      }

      const userData = db.getUser(m.sender);
      const coins = userData.coins ?? 0;
      if (coins < item.price) {
        return await m.reply.error(
          `Not enough coins! *${item.name}* costs ${item.price} 🪙 — you have ${coins.toLocaleString()}.\n\nClaim your daily reward with \`${p}daily\` to earn more.`
        );
      }

      // Deduct coins and apply the effect
      const newCoins = coins - item.price;
      const updates = { coins: newCoins };

      switch (item.id) {
        case 'xp500':
        case 'xp2000': {
          const xpGain = item.id === 'xp500' ? 500 : 2000;
          grantXp(db, m.sender, { xp: xpGain }, updates);
          return await m.reply.success(
            `✅ Purchased *${item.name}* for ${item.price} 🪙!\n\n+${xpGain} XP added.\n🪙 Coins remaining: ${newCoins.toLocaleString()}`
          );
        }
        case 'title':
          updates.customTitle = true;
          db.setUser(m.sender, updates);
          return await m.reply.success(
            `✅ Purchased *${item.name}* for ${item.price} 🪙!\n\nUse \`${p}settitle <your title>\` to set it on your profile.\n🪙 Coins remaining: ${newCoins.toLocaleString()}`
          );
        case 'theme':
          updates.customTheme = true;
          db.setUser(m.sender, updates);
          return await m.reply.success(
            `✅ Purchased *${item.name}* for ${item.price} 🪙!\n\nUse \`${p}settheme\` to pick your menu accent color.\n🪙 Coins remaining: ${newCoins.toLocaleString()}`
          );
        case 'stickers':
          updates.stickerSlots = (userData.stickerSlots ?? 10) + 5;
          db.setUser(m.sender, updates);
          return await m.reply.success(
            `✅ Purchased *${item.name}* for ${item.price} 🪙!\n\nSticker capacity: ${userData.stickerSlots ?? 10} → ${updates.stickerSlots}.\n🪙 Coins remaining: ${newCoins.toLocaleString()}`
          );
      }
      return;
    }

    // ── Shop listing ───────────────────────────────────────────────────
    await withReactionStatus(m, async () => {
      const userData = db.getUser(m.sender);
      const coins = userData.coins ?? 0;

      try {
        await richTableCard(sock, m.from, {
          title:   '🛒 NEXORA COIN SHOP',
          headers: ['ID', 'Item', 'Price', 'Description'],
          rows: SHOP_ITEMS.map(i => [
            i.id,
            i.name,
            `${i.price} 🪙`,
            i.desc,
          ]),
          footer: `Your balance: ${coins.toLocaleString()} 🪙 • Use \`${p}shop buy <id>\` to purchase`,
        }, { quoted: m });

        await actionCard(sock, m.from, {
          text: 'Ready to spend some coins?',
          footer: 'NEXORA Economy',
        }, [
          { label: '🪙 Claim Daily',   cmd: `${p}daily` },
          { label: '💰 Check Balance', cmd: `${p}balance` },
          { label: '🏆 Leaderboard',   cmd: `${p}top` },
        ], { quoted: m });
      } catch (err) {
        console.warn('[shop] richTableCard failed, ASCII fallback:', err.message);
        const lines = SHOP_ITEMS.map(i =>
          `• \`${i.id}\` — ${i.name} (${i.price} 🪙)\n  ${i.desc}`
        );
        lines.push('', `_Your balance: ${coins.toLocaleString()} 🪙_`);
        lines.push('', `Use \`${p}shop buy <id>\` to purchase.`);
        await m.reply(asciiBuilder.box('🛒 COIN SHOP', lines));
      }
    });
  }
};

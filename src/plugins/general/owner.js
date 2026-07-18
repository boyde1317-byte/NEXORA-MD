/**
 * owner.js — bot owner contact card.
 *
 * Sent as a single-card carousel (the fork's `cards` array with exactly one
 * entry) rather than plain text, so it gets the same swipeable-card chrome
 * as the multi-card menu carousel, plus a full nativeFlow button row
 * (call / chat / copy / quick_reply) on that one card.
 *
 * Tier 1: one-card carousel with call/url/copy/quick_reply buttons.
 * Tier 2: mixedCard (flat nativeFlow buttons, no carousel chrome).
 * Tier 3: guaranteed styled asciiBuilder box (no bare plain text).
 *
 * Owner number is intentionally hardcoded per product requirement — this is
 * a fixed contact card, not a per-deployment config value.
 */
import brand from '../../../config/brand.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

const OWNER_NUMBER = '233533416608';

function buildCaption() {
  return (
    `👑 *${brand.name.toUpperCase()} OWNER CARD*\n\n` +
    `Name: ${brand.creator}\n` +
    `Role: Developer & Bot Owner\n` +
    `Bot: ${brand.name}\n\n` +
    `Use the buttons below to call, chat, or copy the number.\n\n` +
    `_${brand.signature}_`
  );
}

export default {
  name: 'owner',
  aliases: ['creator', 'dev', 'developer'],
  category: 'general',
  description: "Shows the bot owner's contact card.",
  cooldown: 3000,
  execute: async ({ sock, m, prefix }) => {
    const p = prefix || '.';
    const caption = buildCaption();
    const thumbnail = await getBrandThumbnail();

    const buttons = [
      { text: 'Call Owner',        call: `+${OWNER_NUMBER}` },
      { text: '💬 Chat on WhatsApp',  url:  `https://wa.me/${OWNER_NUMBER}` },
      { text: '📋 Copy Number',       copy: OWNER_NUMBER },
      { text: 'ℹ️ About Bot',         id:   `${p}about` },
    ];

    // ── Tier 1: one-card carousel ────────────────────────────────────────────
    try {
      return await baileysBridge.sendCarousel(sock, m.from, {
        text: `👑 ${brand.name} — Owner Card`,
        cards: [{
          caption,
          footer: brand.signature,
          nativeFlow: buttons,
          ...(thumbnail ? { image: thumbnail } : {}),
        }],
      }, { quoted: m });
    } catch (err) {
      console.warn('[owner] Tier 1 (carousel) failed, trying mixedCard:', err.message);
    }

    // ── Tier 2: mixedCard fallback (same buttons, no carousel chrome) ────────
    try {
      return await mixedCard(sock, m.from, {
        text: caption,
        footer: brand.signature,
      }, [
        { kind: 'call',   label: 'Call Owner',       phone: `+${OWNER_NUMBER}` },
        { kind: 'url',    label: '💬 Chat on WhatsApp', url:   `https://wa.me/${OWNER_NUMBER}` },
        { kind: 'copy',   label: '📋 Copy Number',      value: OWNER_NUMBER },
        { kind: 'action', label: 'ℹ️ About Bot',        cmd:   `${p}about` },
      ], { quoted: m });
    } catch (err) {
      console.warn('[owner] Tier 2 (mixedCard) failed, plain text:', err.message);
    }

    // ── Tier 3: guaranteed styled fallback (still not bare plain text) ──────
    return await sock.sendMessage(m.from, {
      text: asciiBuilder.box(`👑 ${brand.name.toUpperCase()} — OWNER CARD`, [
        `Name: ${brand.creator}`,
        `Role: Developer & Bot Owner`,
        `Number: +${OWNER_NUMBER}`,
        `WhatsApp: https://wa.me/${OWNER_NUMBER}`,
      ]),
    }, { quoted: m });
  }
};

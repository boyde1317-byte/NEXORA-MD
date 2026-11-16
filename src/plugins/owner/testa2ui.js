/**
 * testa2ui.js — owner-only audit for the A2UI v0.9 surface layer.
 *
 * Every component in the A2UI basic catalog gets its own card, so a component
 * the device rejects can be isolated instead of taking a whole card down.
 * `check` runs the same validation the send path uses, without sending
 * anything — run it first, then sweep the components on a real phone.
 *
 * Usage:
 *   .testa2ui            → picker with every audit surface
 *   .testa2ui <id>       → send that one surface (text fallback if it fails)
 *   .testa2ui all        → send every surface in sequence
 *   .testa2ui list       → text list of ids
 *   .testa2ui check      → local validation report (nothing is sent)
 *   .testa2ui probe      → 3 variants of one card, to see what the device renders
 *   .testa2ui catalog    → the 18 catalog component names
 *
 * Every card here is sent through a2uiKit.sendA2uiSurface, which now always
 * attaches native-flow CTAs. A widget-only interactiveMessage is accepted by
 * WhatsApp and then paints nothing on clients that do not render the
 * BloksWidget slot — that was the "menu 20 / testa2ui shows nothing" report.
 */
import { selectMenu } from '../../lib/interactiveKit.js';
import {
  A2UI_COMPONENTS,
  a2uiSupported,
  auditSurfaces,
  buildA2ui,
  sendA2uiSurface,
} from '../../lib/a2uiKit.js';

const GROUP_ORDER = ['Layout', 'Media', 'Actions', 'Inputs', 'Sweep'];

// A burst of 18 interactiveMessages gets throttled/dropped by WhatsApp, which
// reads as "the sweep only half arrived". Space the sends out.
const SEND_GAP_MS = 1200;
const gap = () => new Promise((r) => setTimeout(r, SEND_GAP_MS));

const groupSurfaces = () => {
  const groups = {};
  for (const t of auditSurfaces()) {
    (groups[t.group] ||= []).push(t);
  }
  return groups;
};

export default {
  name: 'testa2ui',
  aliases: ['a2uitest', 'surfacebind'],
  category: 'owner',
  description: '🧪 A2UI v0.9 surface audit — one card per catalog component.',
  permissions: { owner: true },
  cooldown: 5000,

  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    const jid = m.from || m.key?.remoteJid || m.chat;
    const type = (args[0] || '').toLowerCase();
    const surfaces = auditSurfaces();

    // ── No arg: picker ─────────────────────────────────────────────────────
    if (!type) {
      const groups = groupSurfaces();
      const sections = GROUP_ORDER
        .filter((g) => groups[g])
        .map((g) => ({
          title: g,
          rows: groups[g].map((t) => ({
            id: `${p}testa2ui ${t.id}`,
            title: t.label,
            description: t.note || `A2UI component surface: ${t.id}`,
          })),
        }));

      sections.push({
        title: 'Batch',
        rows: [
          { id: `${p}testa2ui probe`, title: '🎯 Probe this phone', description: '3 variants of one card — which one actually renders?' },
          { id: `${p}testa2ui check`, title: '🔍 Validate all (offline)', description: 'Run the pre-send validation, send nothing' },
          { id: `${p}testa2ui all`, title: '🚀 Send every surface', description: `${surfaces.length} cards in sequence` },
          { id: `${p}testa2ui list`, title: '📄 List ids', description: 'Text list of every audit surface' },
        ],
      });

      return selectMenu(
        sock,
        jid,
        {
          text:
            `🧪 *A2UI v0.9 surface audit*\n\n` +
            `Widget slot: ${a2uiSupported() ? '✅ supported by the pinned proto' : '❌ proto cannot carry a widget'}\n` +
            `Catalog: ${A2UI_COMPONENTS.length} components\n` +
            `Every card ships with 2 tap buttons, so it renders even when the widget does not.\n\n` +
            'Pick a surface to send it, validate them all first, or probe the phone.',
          footer: 'NEXORA A2UI audit • owner only',
        },
        '⚙️ Choose surface',
        sections,
        [],
        { quoted: m }
      );
    }

    // ── Catalog listing ────────────────────────────────────────────────────
    if (type === 'catalog') {
      return m.reply(
        `🧩 *A2UI v0.9 basic catalog* (${A2UI_COMPONENTS.length})\n\n` +
          A2UI_COMPONENTS.map((c, i) => `${i + 1}. ${c}`).join('\n')
      );
    }

    // ── Offline validation ────────────────────────────────────────────────
    if (type === 'check') {
      const lines = ['🔍 *A2UI pre-send validation*\n'];
      let failed = 0;
      for (const t of surfaces) {
        const built = buildA2ui({ components: t.build() });
        if (built.ok) {
          lines.push(`✅ ${t.id} — ${built.surface.createSurface.components.length} nodes`);
        } else {
          failed++;
          lines.push(`❌ ${t.id} — ${built.errors.join('; ')}`);
        }
      }
      lines.push(
        `\n*Widget slot:* ${a2uiSupported() ? 'supported' : 'NOT supported by the pinned proto'}` +
          `\n*Summary:* ${surfaces.length - failed} passed, ${failed} failed`
      );
      return m.reply(lines.join('\n'));
    }

    // ── List ───────────────────────────────────────────────────────────────
    if (type === 'list') {
      const groups = groupSurfaces();
      const lines = ['🧪 *A2UI audit surfaces*\n'];
      for (const g of GROUP_ORDER.filter((x) => groups[x])) {
        lines.push(`*${g}:*`);
        for (const t of groups[g]) {
          lines.push(`  • \`${t.id}\` — ${t.label}`);
        }
        lines.push('');
      }
      lines.push(`_Usage: ${p}testa2ui <id> | all | list | check | catalog_`);
      return m.reply(lines.join('\n'));
    }

    // ── Probe: what does this phone actually paint? ────────────────────────
    // Three variants of the same content, so a device test can separate
    // "the envelope is invisible" from "the widget slot is invisible" from
    // "the surface itself is rejected". Menu 20 uses variant A.
    if (type === 'probe') {
      const seed = (surfaces.find((t) => t.id === 'text') || surfaces[0]);
      const components = seed.build();
      const built = buildA2ui({ components });
      const shared = {
        components,
        title: 'A2UI probe',
        subtitle: 'which variant renders?',
        text: 'A2UI probe — this body text must be visible in every variant.',
        footer: 'NEXORA A2UI probe',
      };

      const results = [];
      try {
        await sendA2uiSurface(sock, jid, { ...shared, text: '🅰 widget + 2 buttons (what menu 20 sends)' }, { quoted: m });
        results.push('🅰 widget + buttons — sent');
      } catch (err) {
        results.push(`🅰 widget + buttons — FAILED: ${err.message}`);
      }
      await gap();

      try {
        await sendA2uiSurface(sock, jid, { ...shared, widget: false, text: '🅱 buttons only, no widget' }, { quoted: m });
        results.push('🅱 buttons only — sent');
      } catch (err) {
        results.push(`🅱 buttons only — FAILED: ${err.message}`);
      }
      await gap();

      try {
        await sock.sendMessage(jid, { text: '🅲 plain text — this one always arrives' }, { quoted: m });
        results.push('🅲 plain text — sent');
      } catch (err) {
        results.push(`🅲 plain text — FAILED: ${err.message}`);
      }

      return m.reply(
        `🎯 *A2UI probe sent*\n\n${results.join('\n')}\n\n` +
          `*How to read it:*\n` +
          `• A and B visible → the card renders; the widget is the only question.\n` +
          `• Only B visible → this client does not paint the BloksWidget slot, so cards must keep their buttons (they do now).\n` +
          `• Only C visible → interactive cards are being dropped on this chat; use \`${p}menu 13\` or \`${p}menu 14\` meanwhile.\n` +
          `_Widget slot (pinned proto): ${a2uiSupported() ? 'supported' : 'NOT supported'}; surface nodes: ${built.ok ? built.surface.createSurface.components.length : 'invalid'}_`
      );
    }

    // ── Send every surface ─────────────────────────────────────────────────
    if (type === 'all') {
      await m.reply(`🧪 Sending ${surfaces.length} A2UI surfaces…`);
      const results = [];
      for (const t of surfaces) {
        const built = buildA2ui({ components: t.build() });
        if (!built.ok) {
          results.push(`❌ ${t.id} — validation: ${built.errors.join('; ')}`);
          continue;
        }
        try {
          await sendA2uiSurface(
            sock,
            jid,
            {
              components: t.build(),
              title: `A2UI • ${t.id}`,
              text: built.text || `A2UI ${t.id}`,
              footer: 'NEXORA A2UI audit',
            },
            { quoted: m }
          );
          results.push(`✅ ${t.id}`);
        } catch (err) {
          results.push(`❌ ${t.id} — send: ${err.message}`);
        }
        await gap();
      }
      const ok = results.filter((r) => r.startsWith('✅')).length;
      return m.reply(
        `🧪 *A2UI audit results*\n\n${results.join('\n')}\n\n*Summary:* ${ok} sent, ${results.length - ok} failed`
      );
    }

    // ── One surface ────────────────────────────────────────────────────────
    const target = surfaces.find((t) => t.id === type);
    if (!target) {
      return m.reply.error(
        `Unknown surface: *"${type}"*\n\nValid: ${surfaces.map((t) => t.id).join(', ')}, all, list, check, probe, catalog`
      );
    }

    const components = target.build();
    const built = buildA2ui({ components });
    if (!built.ok) {
      return m.reply.error(`Surface *"${type}"* failed validation:\n${built.errors.join('\n')}`);
    }

    await sendA2uiSurface(
      sock,
      jid,
      {
        components,
        title: `A2UI • ${target.id}`,
        subtitle: target.group,
        text: built.text || `A2UI ${target.id}`,
        footer: 'NEXORA A2UI audit',
      },
      { quoted: m }
    );
  },
};

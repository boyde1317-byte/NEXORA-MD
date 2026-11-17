/**
 * testa2ui.js — owner-only audit for the A2UI v0.9 surface layer.
 *
 * Every component in the A2UI basic catalog gets its own card, so a component
 * the device rejects can be isolated instead of taking a whole card down.
 * `check` runs the same validation the send path uses, without sending
 * anything — run it first, then sweep the components on a real phone.
 *
 * HONEST LIMIT: `InteractiveMessage.bloksWidget` (tag 66) is not part of
 * WhatsApp's protocol — upstream WAProto knows header/body/footer plus the
 * shop/collection/nativeFlow/carousel oneof and nothing else — so a real
 * client drops the widget and paints only the envelope. These surfaces are
 * therefore a payload audit (schema-valid, sent, received), not a check that
 * a phone will draw the component tree.
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
          { id: `${p}testa2ui probe`, title: '🎯 Probe this phone', description: 'one surface in 3 wire shapes — which one paints the A2UI panel?' },
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
          lines.push(`✅ ${t.id} — ${built.components.length} nodes`);
        } else {
          failed++;
          lines.push(`❌ ${t.id} — ${built.errors.join('; ')}`);
        }
      }
      lines.push(
        `\n*Widget slot:* ${a2uiSupported() ? 'in the fork proto only' : 'absent from the proto'}` +
          `\n*Note:* WhatsApp has no bloksWidget field, so cards render as plain interactive messages.` +
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
        subtitle: 'which payload shape renders?',
        footer: 'NEXORA A2UI probe',
      };

      // Same surface, three wire shapes. The widget area shows something only
      // for the shape this client actually parses; everything else still
      // arrives as a normal card thanks to the CTA layer.
      const variants = [
        ['🅰 wrapper', 'wrapper', '{ messages: [createSurface, updateComponents] }'],
        ['🅱 list', 'list', 'raw [createSurface, updateComponents] array'],
        ['🅲 legacy', 'legacy', "fork's single createSurface object"],
      ];

      const results = [];
      for (const [label, shape, note] of variants) {
        try {
          await sendA2uiSurface(
            sock,
            jid,
            { ...shared, shape, text: `${label} — ${note}` },
            { quoted: m }
          );
          results.push(`${label} — sent`);
        } catch (err) {
          results.push(`${label} — FAILED: ${err.message}`);
        }
        await gap();
      }

      return m.reply(
        `🎯 *A2UI payload probe sent*\n\n${results.join('\n')}\n\n` +
          `*Read it like this:* the body + buttons arrive in all three (that layer is proven). ` +
          `Whichever card also shows the A2UI panel is the shape this client parses.\n\n` +
          `• 🅰 or 🅱 renders → we are on spec v0.9 and only the envelope was wrong.\n` +
          `• Only 🅲 renders → this client wants the fork's legacy object.\n` +
          `• None render → the client ignores the BloksWidget slot entirely for this account; ` +
          `no payload shape will paint it.\n\n` +
          `_Widget slot (pinned proto): ${a2uiSupported() ? 'supported' : 'NOT supported'}; surface nodes: ${built.ok ? built.components.length : 'invalid'}_`
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

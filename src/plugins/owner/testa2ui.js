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
 *   .testa2ui catalog    → the 18 catalog component names
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
            `Catalog: ${A2UI_COMPONENTS.length} components\n\n` +
            'Pick a surface to send it, or validate them all first.',
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
        `Unknown surface: *"${type}"*\n\nValid: ${surfaces.map((t) => t.id).join(', ')}, all, list, check, catalog`
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

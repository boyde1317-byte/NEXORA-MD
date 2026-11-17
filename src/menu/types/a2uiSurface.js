import { A2, buildA2ui, sendA2uiSurface, surfaceToText } from '../../lib/a2uiKit.js';
import { selectMenu } from '../../lib/interactiveKit.js';
import { buildTextMenu } from '../formatter.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Menu 20 — the rich card menu (pick it with `.setmenu 20`).
 *
 * NOTE ON NAMING: this started as an A2UI v0.9 BloksWidget menu. That slot is
 * not part of WhatsApp's protocol — `InteractiveMessage.bloksWidget` (tag 66)
 * exists only in the fork's hand-edited proto, so a real client drops it and
 * the card arrives empty apart from its own text and CTAs. What the client
 * does paint is a native-flow card, which is what the renderer sends now:
 *   - the brand banner in the card header
 *   - a stats body (commands, categories, uptime) written from the surface
 *   - a category picker: one section per category, a row per command
 *   - three link buttons (panel, channel, repo)
 *
 * The A2UI component tree is still built and validated (it is the source of
 * the body text and of the `.testa2ui` payload audit), but it is no longer
 * what carries the menu. If the card send throws, the plain-text menu is the
 * fallback, so a menu is never left empty.
 *
 * Pick it with `.setmenu 20` / `.menu a2uiSurface`.
 */

const PANEL_URL = 'https://nexora-telegram.fly.dev';
const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326';
const GITHUB_URL = 'https://github.com/boyde1317-byte/NEXORA-MD';

/**
 * Build the component tree for the menu surface.
 * Pure — the offline verify suite renders it without a socket.
 *
 * @param {object} menuData  collectMenuData() output
 * @returns {object[]} A2UI components (exactly one `root`)
 */
export const buildA2uiMenuComponents = (menuData = {}) => {
  const categories = Object.keys(menuData.categories || {}).sort();
  const stats = [
    `Commands: ${menuData.totalCommands ?? '—'}`,
    `Categories: ${categories.length}`,
    `Users: ${menuData.users ?? '—'}`,
    `Groups: ${menuData.groups ?? '—'}`,
    `Uptime: ${menuData.uptime ?? '—'}`,
    `Prefix: ${menuData.prefix || '.'}`,
  ].join('\n');

  // Busiest categories first, capped so the list stays readable on a phone
  const busiest = categories
    .map((cat) => ({ cat, count: (menuData.categories[cat] || []).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topCommands = categories
    .flatMap((cat) => (menuData.categories[cat] || []).map((c) => ({ cat, name: c.name })))
    .slice(0, 10);

  const components = [
    A2.column('root', ['banner', 'title', 'rule1', 'stats', 'tabs', 'rule2', 'links']),

    A2.image('banner', ASSET_URLS.menuBanner, {
      variant: 'header',
      fit: 'cover',
      description: `${menuData.botName || 'NEXORA MD'} banner`,
    }),
    A2.text('title', `${menuData.botName || 'NEXORA MD'} — command menu`, 'h3'),
    A2.divider('rule1'),
    A2.text('stats', stats),

    A2.tabs('tabs', [
      { title: 'Categories', child: 'categories_panel' },
      { title: 'Top', child: 'top_panel' },
      { title: 'Links', child: 'links_panel' },
    ]),

    // ── Tab 1: every category with its command count ──
    A2.column('categories_panel', ['cat_intro', 'cat_list']),
    A2.text('cat_intro', 'Tap a category below, then run `.help <category>` for the full list.', 'caption'),
    A2.list('cat_list', busiest.map((b) => `cat_${b.cat}`), { listStyle: 'unordered' }),
    ...busiest.map((b) => A2.text(`cat_${b.cat}`, `${b.cat} — ${b.count} commands`)),

    // ── Tab 2: a slice of the command surface ──
    A2.column('top_panel', ['top_intro', 'top_list']),
    A2.text('top_intro', 'A quick slice of what NEXORA can do:', 'caption'),
    A2.list('top_list', topCommands.map((c, i) => `top_${i}`), { listStyle: 'ordered' }),
    ...topCommands.map((c, i) => A2.text(`top_${i}`, `${menuData.prefix || '.'}${c.name} — ${c.cat}`)),

    // ── Tab 3: where to go next ──
    A2.column('links_panel', ['link_intro', 'link_row']),
    A2.text('link_intro', 'NEXORA lives in a few places:', 'caption'),
    A2.row('link_row', ['lbl_panel', 'lbl_channel', 'lbl_repo'], { justify: 'spaceBetween', align: 'center' }),
    A2.text('lbl_panel', 'Panel'),
    A2.text('lbl_channel', 'Channel'),
    A2.text('lbl_repo', 'GitHub'),

    A2.divider('rule2'),
    // Buttons must be reachable from root: the fork's validator only checks
    // that references resolve, but the device rejects surfaces with orphan
    // components (A2UIValidationException, no card). Keep every button id
    // listed here, matching the audit 'button' surface in a2uiKit.js.
    A2.column('links', ['open_panel', 'open_channel', 'open_repo', 'btn_panel', 'btn_channel', 'btn_repo']),
    A2.text('open_panel', 'Open the NEXORA panel'),
    A2.text('open_channel', 'Join the NEXORA channel'),
    A2.text('open_repo', 'NEXORA on GitHub'),
    A2.urlButton('btn_panel', 'open_panel', PANEL_URL, { variant: 'primary' }),
    A2.urlButton('btn_channel', 'open_channel', CHANNEL_URL, { variant: 'borderless' }),
    A2.urlButton('btn_repo', 'open_repo', GITHUB_URL, { variant: 'borderless' }),
  ];

  return components;
};

/**
 * The exact card payload for menu 20 — the surface plus the native-flow CTAs
 * that keep it visible on every client. Exported so the release gate can
 * assert the CTAs are present (a widget-only envelope renders as nothing).
 *
 * @param {object} menuData  collectMenuData() output
 * @returns {object} sendA2uiSurface spec
 */
export const buildA2uiMenuSpec = (menuData = {}) => ({
  components: buildA2uiMenuComponents(menuData),
  title: menuData.botName || 'NEXORA MD',
  subtitle: `${menuData.totalCommands ?? '—'} commands • ${menuData.uptime ?? ''}`.trim(),
  text: `✦ ${menuData.botName || 'NEXORA MD'} — ${menuData.totalCommands ?? '—'} commands across ${Object.keys(menuData.categories || {}).length} categories`,
  footer: `${menuData.prefix || '.'}help <category> • ${menuData.botName || 'NEXORA MD'}`,
  buttons: [
    { text: 'Open panel', url: PANEL_URL },
    { text: 'Channel', url: CHANNEL_URL },
    { text: 'GitHub', url: GITHUB_URL },
  ],
});

/** The three link buttons every menu card carries. */
export const MENU_LINKS = [
  { text: 'Open panel', url: PANEL_URL },
  { text: 'Channel', url: CHANNEL_URL },
  { text: 'GitHub', url: GITHUB_URL },
];

/**
 * The picker the renderer sends: one section per category, each row opening
 * that category's help page. Native-flow lists cap out at 10 rows per section
 * and about 3 sections in practice, so the busiest categories lead.
 *
 * @param {object} menuData  collectMenuData() output
 * @returns {Array<{title: string, rows: Array<{id: string, title: string, description: string}>}>}
 */
export const buildMenuSections = (menuData = {}) => {
  const prefix = menuData.prefix || '.';
  const categories = menuData.categories || {};
  const names = Object.keys(categories)
    .sort((a, b) => (categories[b]?.length || 0) - (categories[a]?.length || 0))
    .slice(0, 3);

  return names.map((cat) => ({
    title: `${cat.toUpperCase()} — ${categories[cat].length} commands`,
    rows: categories[cat].slice(0, 10).map((cmd) => ({
      id: `${prefix}help ${cat}`,
      title: `${prefix}${cmd.name}`,
      description: String(cmd.description || '').slice(0, 70) || cat,
    })),
  }));
};

export const a2uiSurfaceMenu = {
  id: 20,
  name: 'a2uiSurface',
  description: 'Rich card menu — banner, category picker and tap-to-open links',
  supportedMessages: ['interactiveMessage', 'buttonsMessage', 'extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const jid = m.from || m.key?.remoteJid || m.chat;
    const fallbackText = buildTextMenu(menuData);

    // The A2UI v0.9 surface is composed and validated on every render, but it
    // is NOT what the card renders: `InteractiveMessage.bloksWidget` (proto tag
    // 66) does not exist in WhatsApp's proto — upstream WAProto lists header/
    // body/footer + the shop/collection/nativeFlow/carousel oneof and nothing
    // else — so the client drops the unknown field. Only the envelope shows up,
    // which is why this menu used to arrive as bare text plus CTAs.
    //
    // So the menu is built from what the client actually paints: a native-flow
    // single-select list (one section per category) with the brand banner and
    // the three link buttons. The surface text is reused as the body.
    const built = buildA2ui({ components: buildA2uiMenuComponents(menuData) });
    if (!built.ok) {
      console.warn('[a2uiSurface] surface rejected — text menu:', built.errors.join('; '));
    }

    try {
      return await selectMenu(
        sock,
        jid,
        { text: built.ok ? built.text : fallbackText, footer: `${menuData.botName || 'NEXORA MD'} • tap to browse` },
        '📚 Browse commands',
        buildMenuSections(menuData),
        MENU_LINKS,
        { quoted: m }
      );
    } catch (err) {
      console.warn('[a2uiSurface] interactive card failed — text menu:', err.message);
      return sock.sendMessage(jid, { text: fallbackText }, { quoted: m });
    }
  },
};

export { surfaceToText };
export default a2uiSurfaceMenu;

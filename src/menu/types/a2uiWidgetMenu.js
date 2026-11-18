/**
 * a2uiWidgetMenu.js — menu 25, the A2UI widget card (ALYA BOT's level card shape).
 *
 * What makes this different from menu 16: the surface is ONE `createSurface`
 * message with its components inline, handed to `interactiveMessage.bloksWidget`
 * as `type: 'im_a2ui'`. Menu 16 used to send createSurface followed by
 * updateComponents, and a client that only reads createSurface paints an empty
 * surface — which is exactly the blank card we kept seeing. ALYA BOT ships the
 * inline form and it renders, so this style reproduces that byte for byte:
 *
 *   interactiveMessage {
 *     header: { title: '', hasMediaAttachment: false }
 *     body:   { text: <one line> }
 *     footer: { text: <bot name> }
 *     nativeFlowMessage: {}
 *     bloksWidget: { uuid, type: 'im_a2ui', data: JSON, fallback: text }
 *   }
 *
 * Pick it with `.setmenu 25`. If the card ever comes up blank again, the rich
 * card in menu 16 is the fallback that is known to paint.
 */
import crypto from 'crypto';
import { generateWAMessageFromContent } from 'baileys';
import brand from '../../../config/brand.js';
import { buildA2uiMessages, A2UI_WIDGET_TYPE } from '../../lib/a2uiKit.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { buildTextMenu } from '../formatter.js';
import { DIM_BODY, greyCopy } from '../../lib/dimCard.js';

const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326';

/**
 * The surface, built the way the client reads it: components inline.
 * Pure — no socket, no menu data mutation.
 */
export function buildWidgetSurface(menuData = {}) {
  const p = menuData.prefix || '.';
  const name = displayName(menuData.botName || brand.name || 'NEXORA MD');
  const total = menuData.totalCommands ?? '—';
  const cats = Object.keys(menuData.categories || {});

  const info = [
    `Commands : ${total}`,
    `Categories : ${cats.length}`,
    `Uptime : ${menuData.uptime || '—'}`,
    `Prefix : ${p}`,
  ].join('\n');

  const components = [
    { id: 'root', component: 'Column', justify: 'center', align: 'center', children: ['img', 'lv', 'nm', 'div1', 'info', 'div2', 'btn', 'ft'] },
    ...(ASSET_URLS?.menuBanner
      ? [{ id: 'img', component: 'Image', url: ASSET_URLS.menuBanner, variant: 'header', fit: 'cover' }]
      : []),
    { id: 'lv', component: 'Text', text: `${name}`, variant: 'h1' },
    { id: 'nm', component: 'Text', text: `${total} commands • ${cats.length} categories`, variant: 'caption' },
    { id: 'div1', component: 'Divider', axis: 'horizontal' },
    { id: 'info', component: 'Text', text: info, variant: 'body' },
    { id: 'div2', component: 'Divider', axis: 'horizontal' },
    { id: 'btn', component: 'Button', child: 'btnTxt', variant: 'primary', action: { call: 'openUrl', args: { url: CHANNEL_URL } } },
    { id: 'btnTxt', component: 'Text', text: 'Official Channel', variant: 'body' },
    { id: 'ft', component: 'Text', text: `Send ${p}help <category> to drill in`, variant: 'caption' },
  ];

  // Drop dangling children if the banner is missing.
  const ids = new Set(components.map((c) => c.id));
  components[0].children = components[0].children.filter((id) => ids.has(id));

  // A plain surface id, not the fork's 'starcore-widget=' namespace: the card
  // that renders in the wild (ALYA BOT) uses a bare id.
  return buildA2uiMessages({ uuid: crypto.randomUUID(), shape: 'inline', surfaceId: 'nexora-menu', components });
}

const renderer = async ({ sock, m, menuData }) => {
  const p = menuData.prefix || '.';
  const name = displayName(menuData.botName || brand.name || 'NEXORA MD');
  const surface = buildWidgetSurface(menuData);
  const fallback = `✦ ${name} ✦\n${menuData.totalCommands ?? '—'} commands\n\n${buildTextMenu(menuData)}`.slice(0, 4000);

  const message = {
    messageContextInfo: { messageSecret: crypto.randomBytes(32) },
    interactiveMessage: {
      header: { title: '', hasMediaAttachment: false },
      // House style: the copy rides in the footer (small, grey) and the body is a
      // single zero-width space, exactly like menu 21.
      body: { text: DIM_BODY },
      footer: { text: greyCopy(name, `Send ${p}help <category> to drill in`).footer },
      nativeFlowMessage: {},
      bloksWidget: {
        uuid: surface.createSurface.surfaceId,
        type: A2UI_WIDGET_TYPE,
        data: JSON.stringify(surface),
        fallback,
      },
    },
  };

  const generated = generateWAMessageFromContent(
    m.from,
    { ...message, messageContextInfo: { ...message.messageContextInfo, deviceListMetadata: {}, deviceListMetadataVersion: 2 } },
    { userJid: sock.user?.id }
  );

  await sock.relayMessage(m.from, generated.message, { messageId: generated.key.id });
  return true;
};

export const a2uiWidgetMenu = {
  id: 25,
  name: 'a2uiWidget',
  description: 'A2UI widget card — one inline createSurface inside bloksWidget (ALYA BOT shape)',
  supportedMessages: ['interactiveMessage'],
  renderer,
};

export default a2uiWidgetMenu;

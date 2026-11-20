import crypto from 'crypto';
import { prepareWAMessageMedia, generateWAMessageFromContent } from 'baileys';
import { getDisplayName } from '../../lib/displayName.js';

/**
 * Menu 22 — zapo menu (pick it with `.setmenu 22` / `.menu zapoMenu`).
 *
 * Ported from the LUNA MD menu5.js plugin: a zapo-style A2UI card — video
 * header, native-flow category picker, and a BloksWidget card tree.
 *
 * Read this before "fixing" the widget: `InteractiveMessage.bloksWidget`
 * (proto tag 66) does not exist in WhatsApp's proto — the fork's
 * hand-edited proto has it, real clients drop it. So the card the user
 * actually sees is the native-flow envelope (video header + single-select
 * buttons + URL button); the widget tree below is still built and sent
 * because a forked client may paint it, but nothing in the renderer
 * depends on it for content. Same situation as menu 20 (a2uiSurface.js),
 * same conclusion: the native flow carries the menu.
 *
 * Differences from the LUNA MD original:
 *   - It is a menu TYPE, not a plugin: renderer({ sock, m, menuData })
 *     instead of handler(m, { conn, usedPrefix, args }). Menu types get
 *     no args, so the original's `.menu list|all|<category>` views are
 *     gone — the renderer always shows the main menu, and category
 *     drill-down lives where NexoraFlex already puts it: `.help <category>`
 *     (the native-flow rows point there, following a2uiSurface.js).
 *     `.menu <arg>` in NexoraFlex selects a MENU STYLE, so pointing the
 *     rows at `.menu <category>` would have opened the wrong thing.
 *   - Command counts come from menuData.categories (collectMenuData),
 *     not from a `global.plugins` scan — NexoraFlex has no such global;
 *     its registry is client.commands, already grouped by the collector.
 *   - `m.chat` -> `m.from`, `conn` -> `sock`, `m.pushName` -> await
 *     getDisplayName(sock, m.sender) (NexoraFlex never sets pushName).
 *     `usedPrefix` -> menuData.prefix; owner number -> menuData.ownerNumber.
 *   - moment-timezone is not a NexoraFlex dependency: the date is built
 *     with Intl.DateTimeFormat('en-GH', timeZone 'Africa/Accra').
 *   - axios is not a NexoraFlex dependency either (only an overrides
 *     entry): the video is fetched with global fetch + AbortSignal timeout,
 *     keeping the original's dead-link detection (HTML response -> look
 *     for an .mp4 URL inside it and refetch).
 *   - If the video host is down entirely, the card is sent with a plain
 *     title header instead of throwing — the original only fell back to
 *     a URL upload and then threw, which would have dropped the user to
 *     the text menu for a dead video link.
 *   - orderMessage currency IDR -> USD; everything else in the fake quote
 *     (orderId, totals, the embedded moon-and-crown thumbnail) is kept
 *     verbatim, as is the senderKeyDistributionMessage boilerplate and
 *     the biz additionalNodes block.
 *   - The 2s menu throttle moved from conn.menuLastRequest to a
 *     module-level timestamp (one process, one socket).
 */
const VIDEO_URL = 'https://cdn.zass.in/XYhlqsupY0.mp4';
// Zapo's own logo, used inside the widget tree. Third-party hotlink, kept
// as-is from the original — the style's artwork, not a NEXORA asset.
const ZAPO_LOGO = 'https://raw.githubusercontent.com/vinikjkkj/zapo/master/.github/assets/logo-light.png';
const WIDGET_UUID = '4b108b98-fb8e-4d18-a24a-9572b5805785';
// Moon-and-crown thumbnail embedded in the fake orderMessage quote.
// Carried over byte-for-byte from the LUNA original (it was already a
// LUNA MD replacement image, generated when the pasted plugin's own
// thumbnail had been stripped).
const MOON_THUMBNAIL = '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';

let lastZapoRequest = 0;

function clockString(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function formatAccraDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GH', {
    timeZone: 'Africa/Accra',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function buildNativeButtons({ prefix, botName, totalCommands, categories, countTag, devNumber }) {
  const catRows = categories.map((c) => ({
    title: c.toUpperCase(),
    description: `${countTag(c)} commands`,
    id: `${prefix}help ${c}`,
  }));
  const btn1 = {
    title: '\u0000',
    sections: [
      { title: botName, highlight_label: 'MAIN MENU', rows: [{ title: 'All Menu', description: `${totalCommands} commands`, id: `${prefix}help` }] },
      { title: 'Category', rows: catRows },
    ],
    icon: 'DEFAULT',
  };
  const btn2 = {
    title: '\u0000',
    sections: [{
      title: botName,
      highlight_label: 'INFORMATION',
      rows: [
        { title: 'Menu', description: 'Back to main menu', id: `${prefix}menu` },
        { title: 'Owner', description: 'Contact the bot owner', id: `${prefix}o` },
        { title: 'ping', description: 'Check bot speed', id: `${prefix}ping` },
      ],
    }],
    icon: 'REVIEW',
  };
  const devLink = `https://wa.me/${devNumber}`;
  const btn3 = { display_text: '\u0000', url: devLink, merchant_url: devLink, icon: 'PROMOTION' };
  return { btn1, btn2, btn3 };
}

function buildMetaCards(menuText, devNumber, menuTitle, userInfo) {
  return {
    uuid: WIDGET_UUID,
    type: 'im_a2ui',
    data: JSON.stringify({
      version: 'v0.9',
      createSurface: {
        surfaceId: `starcore-widget=${WIDGET_UUID}`,
        catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
        components: [
          { id: 'root', component: 'Column', children: ['card_4', 'card_a', 'card_polling', 'card_e'] },
          { id: 'image_0', component: 'Image', url: ZAPO_LOGO, variant: 'smallFeature', fit: 'contain' },
          { id: 'text_1', component: 'Text', text: '🤖 NEXORA MD', variant: 'h1' },
          { id: 'text_2', component: 'Text', text: `⚡ Fast, light & stable WhatsApp bot.\n\n${userInfo.user}\n${userInfo.status}`, variant: 'body' },
          { id: 'column_3', component: 'Column', children: ['image_0', 'text_1', 'text_2'] },
          { id: 'card_4', component: 'Card', child: 'column_3' },
          { id: 'text_5', component: 'Text', text: '✨ Main Features', variant: 'h2' },
          { id: 'checkbox_6', component: 'CheckBox', label: 'Plugin system (command + alias)', value: true },
          { id: 'checkbox_7', component: 'CheckBox', label: 'Reload plugins without a full restart', value: true },
          { id: 'checkbox_8', component: 'CheckBox', label: 'Session saved in SQLite', value: true },
          { id: 'column_9', component: 'Column', children: ['text_5', 'checkbox_6', 'checkbox_7', 'checkbox_8'] },
          { id: 'card_a', component: 'Card', child: 'column_9' },
          { id: 'text_poll', component: 'Text', text: menuTitle, variant: 'h2' },
          { id: 'text_poll2', component: 'Text', text: menuText, variant: 'body' },
          { id: 'text_status', component: 'Text', text: userInfo.status, variant: 'body' },
          { id: 'text_user', component: 'Text', text: userInfo.user, variant: 'body' },
          { id: 'column_poll', component: 'Column', children: ['text_poll', 'text_poll2', 'text_status', 'text_user'] },
          { id: 'card_polling', component: 'Card', child: 'column_poll' },
          { id: 'text_b', component: 'Text', text: '📞 Contact Developer', variant: 'h2' },
          { id: 'text_c', component: 'Text', text: `Tap the button below to contact the developer ${devNumber}.`, variant: 'caption' },
          { id: 'column_d', component: 'Column', children: ['text_b', 'text_c'] },
          { id: 'card_e', component: 'Card', child: 'column_d' },
        ],
      },
    }),
  };
}

async function fetchVideoBuffer() {
  const res = await fetch(VIDEO_URL, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'video/mp4,video/*,*/*' },
  });
  let buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 10000 || buffer.toString('utf8', 0, 300).includes('<html')) {
    const html = buffer.toString();
    const found = html.match(/https?:\/\/[^"'\s]+\.mp4/gi);
    if (found && found[0]) {
      const r2 = await fetch(found[0], { signal: AbortSignal.timeout(30000) });
      buffer = Buffer.from(await r2.arrayBuffer());
    } else {
      throw new Error('video link is dead');
    }
  }
  return buffer;
}

export const zapoMenu = {
  id: 22,
  name: 'zapoMenu',
  description: 'Zapo-style menu — video header, native-flow category picker, A2UI widget card',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const jid = m.from || m.key?.remoteJid || m.chat;
    const botName = menuData.botName || 'NEXORA MD';
    const prefix = menuData.prefix || '.';
    const devNumber = menuData.ownerNumber || '233533416608';
    const ownerName = menuData.ownerName || 'Moonson';

    // 2s throttle, same as the original (was conn.menuLastRequest).
    if (lastZapoRequest && Date.now() - lastZapoRequest < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    lastZapoRequest = Date.now();

    await sock.relayMessage(jid, {
      interactiveMessage: {
        header: { title: botName },
        body: { text: `Please wait a moment, ${botName} is preparing the command list...` },
        footer: { text: '\u0000' },
        nativeFlowMessage: { buttons: [{ name: 'inapp_signup', buttonParamsJson: '{}' }] },
        contextInfo: {
          forwardingScore: 99,
          isForwarded: true,
          participant: '0@s.whatsapp.net',
          remoteJid: 'status@broadcast',
          quotedMessage: {
            orderMessage: {
              orderId: '2026',
              thumbnail: MOON_THUMBNAIL,
              orderTitle: `${botName} - 2026 ELEMENTS`,
              sellerJid: '0@s.whatsapp.net',
              totalAmount1000: 2026000,
              totalCurrencyCode: 'USD',
              message: `${botName} - 2026 DOCS`,
              surface: 0,
              itemCount: 2026,
            },
          },
        },
      },
      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, messageSecret: crypto.randomBytes(32) },
    }, {});

    await new Promise((r) => setTimeout(r, 500));

    const categories = Object.keys(menuData.categories || {}).sort();
    const totalCommands = menuData.totalCommands ?? 0;
    const totalUsers = menuData.users ?? 0;
    const uptime = menuData.uptime || clockString(process.uptime() * 1000);
    const countTag = (t) => (menuData.categories?.[t] || []).length;
    const ping = `${Math.floor(Math.random() * 80 + 50)} ms`;
    const date = formatAccraDate();
    let name = m.sender.split('@')[0];
    try { name = (await getDisplayName(sock, m.sender)) || name; } catch (_) {}
    const tag = `@${m.sender.split('@')[0]}`;

    const menuTitle = '📋 MAIN MENU';
    const menuText = `👋 Hello ${tag}\n\n👤 USER INFO\n├ Name : ${name}\n└ Number : ${m.sender.split('@')[0]}\n\n🤖 BOT INFO\n├ Bot : ${botName}\n├ Menu : ${totalCommands} Command\n├ User : ${totalUsers} User\n├ Ping : ${ping}\n├ Uptime : ${uptime}\n└ Date : ${date}\n\n📌 Choose a category below`;

    let media = null;
    try {
      const buffer = await fetchVideoBuffer();
      media = await prepareWAMessageMedia({ video: buffer, gifPlayback: true, mimetype: 'video/mp4' }, { upload: sock.waUploadToServer });
    } catch (e) {
      console.log('[zapoMenu] video buffer upload failed:', e.message);
      try {
        media = await prepareWAMessageMedia({ video: { url: VIDEO_URL }, gifPlayback: true }, { upload: sock.waUploadToServer });
      } catch (e2) {
        // Video host unreachable — send the card with a plain title header
        // instead of dropping the user to the text fallback.
        console.log('[zapoMenu] video unavailable, sending without header media:', e2.message);
        media = null;
      }
    }

    const userInfo = {
      status: `🟢 ONLINE | ${date} | ${ping} | ${uptime}`,
      user: `👤 ${name} - ${m.sender.split('@')[0]} - ${ping} - ${totalUsers} Users`,
    };
    const bloksWidget = buildMetaCards(menuText, devNumber, menuTitle, userInfo);
    const { btn1, btn2, btn3 } = buildNativeButtons({
      prefix,
      botName,
      totalCommands,
      categories,
      countTag,
      devNumber,
    });

    const interactiveMessage = {
      body: { text: '\u0000' },
      footer: { text: '\u0000' },
      header: media?.videoMessage
        ? { hasMediaAttachment: true, subtitle: '', videoMessage: media.videoMessage }
        : { title: botName },
      nativeFlowMessage: {
        buttons: [
          { name: '' },
          { name: 'single_select', buttonParamsJson: JSON.stringify(btn1) },
          { name: 'single_select', buttonParamsJson: JSON.stringify(btn2) },
          { name: 'cta_url', buttonParamsJson: JSON.stringify(btn3) },
        ],
        messageParamsJson: JSON.stringify({}),
        messageVersion: 1,
      },
      bloksWidget,
      contextInfo: { forwardingScore: 999, isForwarded: true },
    };

    const fkontak = {
      key: { participants: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: 'Nexora' },
      message: {
        contactMessage: {
          displayName: ownerName.toUpperCase(),
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${ownerName};;;\nFN:${ownerName}\nitem1.TEL;waid=${devNumber}:${devNumber}\nitem1.X-ABLabel:Mobile\nEND:VCARD`,
        },
      },
      participant: '0@s.whatsapp.net',
    };

    const msg = generateWAMessageFromContent(jid, { interactiveMessage }, {
      userJid: sock.user?.id || '0@s.whatsapp.net',
      quoted: fkontak,
    });

    msg.message.senderKeyDistributionMessage = {
      groupId: '120363411834515372@g.us',
      axolotlSenderKeyDistributionMessage: 'MwisrvVqEAkaIH5V9fCVi7eATm1/yHsVVPJ/3V5jC2808HsfvB7oFv5zIiEFxv38znEByox+AK30g5b2M1PvewfNtmL+cq8HJtFbrTA=',
    };

    await sock.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
      additionalNodes: [{
        tag: 'biz',
        attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: '1710184201' },
        content: [
          { tag: 'engagement', attrs: { customer_service_state: 'open', conversation_state: 'open' } },
          { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] },
        ],
      }],
    });
  },
};

export default zapoMenu;

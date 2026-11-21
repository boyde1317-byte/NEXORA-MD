/**
 * photoFlowMenu.js — menu style 2 ("photoFlowMenu") — native-flow menu
 * with a photo header, followed by the requester's own photo.
 *
 * Ported from LUNA MD plugins/menu4.js (the "menu4 / rem" card) as a
 * NexoraFlex menu TYPE: renderer({ sock, m, menuData }) instead of a
 * plugin handler. Pick it with `.setmenu 2` / `.menu photoFlowMenu`.
 *
 * What it shows: an interactiveMessage with the brand banner as the
 * header thumbnail, a single_select "OPEN FULL MENU" sheet (Download /
 * All Menu sections) + a channel URL button, then a second message with
 * the requester's profile photo and a caption tagging them.
 *
 * Differences from the LUNA original:
 *   - No overlap with moonsonCard (18, NIXCODE Button card) or
 *     galaxyMenu (19, relayed viewOnce + A2UI card): this one is a plain
 *     native-flow single_select + cta_url card sent with
 *     generateWAMessageFromContent / relayMessage (same shape as
 *     yonoMenu), plus the photo follow-up. No viewOnce envelope, no
 *     BloksWidget, no NIXCODE builder.
 *   - Hardcoded image host (cdn.ornzora.eu.cc FIORA.jpg) -> the brand
 *     banner from ASSET_URLS.menuBanner, fetched with global fetch
 *     (falls back to the requester's profile photo buffer).
 *   - Hardcoded REM channel footer + "REM Channel" button ->
 *     getChannelContext() (`.setchannel` store; falls back to the
 *     default NEXORA Updates invite).
 *   - "LUNA MD - MENU" / "LUNA MD MENU" -> NEXORA MD; body text greets
 *     the requester by display name and states the real command count.
 *   - Sheet rows that pointed at commands that don't exist in NexoraFlex
 *     (`.tools`, `.groupmenu`, `.aimenu`, bare `.ytmp3`) now point at
 *     real invocations: download rows run the downloader commands,
 *     All-Menu rows open the house drill-down (`.help <category>`).
 *   - `m.chat` -> `m.from`; `conn.profilePictureUrl` -> sock.
 *   - If the card relay fails, falls back to a plain-text menu listing
 *     (same pattern as yonoMenu) so the command never goes silent.
 */
import crypto from 'crypto';
import { generateWAMessageFromContent, proto } from 'baileys';
import sharp from 'sharp';
import brand from '../../../config/brand.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { getChannelContext } from '../../lib/channelPromo.js';
import { resolveDisplayIdentity } from '../../lib/identity.js';
import { greyCopy } from '../../lib/dimCard.js';

async function fetchBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Downscale an image buffer to a WhatsApp-friendly size so it downloads
// instead of hanging on a slow connection. Returns the resized JPEG, or the
// original buffer when resizing fails.
async function shrinkImage(buf, maxWidth, quality) {
  try {
    return await sharp(buf).resize({ width: maxWidth, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  } catch (_) {
    return buf;
  }
}

function buildTextFallback(menuData) {
  const lines = [`*${menuData.botName || brand.name} MENU*`, '', `Total commands: ${menuData.totalCommands || 0}`, ''];
  for (const cat of Object.keys(menuData.categories || {})) {
    lines.push(`— ${cat.toUpperCase()} —`);
    for (const cmd of menuData.categories[cat] || []) lines.push(`• ${menuData.prefix}${cmd.name}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export const photoFlowMenu = {
  id: 2,
  name: 'photoFlowMenu',
  description: 'Native-flow menu with photo header + requester photo follow-up',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const p = menuData.prefix || '.';
    const botName = menuData.botName || brand.name || 'NEXORA MD';
    const channel = getChannelContext();
    const channelUrl = channel.invite || '';
    // Username first, phone number when there is no username — never the
    // opaque LID digits (see src/lib/identity.js).
    const id = await resolveDisplayIdentity(sock, m.sender, m.isGroup ? m.from : null);
    const userName = id.username || id.number || id.pushName || 'there';
    const chipLabel = id.username ? `@${id.username}` : id.number ? `@${id.number}` : id.pushName ? `@${id.pushName}` : '@member';
    const chipJid = id.phoneJid || m.sender;

    // Header thumbnail: brand banner, falling back to the requester's photo.
    let thumb = null;
    try { thumb = await fetchBuffer(ASSET_URLS.menuBanner); } catch (_) {}
    let pp = null;
    try { pp = await sock.profilePictureUrl(m.sender, 'image'); } catch (_) {}
    if (!thumb && pp) {
      try { thumb = await fetchBuffer(pp); } catch (_) {}
    }
    // The banner is 2048px / ~270KB (a profile-photo fallback can be far
    // bigger) — far too large for a jpegThumbnail, which is why it loads on
    // tap but never finishes. Shrink it to a proper thumbnail size first.
    if (thumb) thumb = await shrinkImage(thumb, 720, 72);

    // House style (menu 21): the copy rides in the grey footer, the body
    // keeps a zero-width space — the verify gate checks for greyCopy/DIM_BODY.
    const bodyText = `*${botName} MENU*\n\nHi ${userName} — ${menuData.totalCommands || 0} commands across ${Object.keys(menuData.categories || {}).length} categories.\n\nYour photo is below 👇`;
    const grey = greyCopy(bodyText, channelUrl || `${botName} • ${brand.signature || 'By Moonson'}`);

    const msg = generateWAMessageFromContent(m.from, {
      messageContextInfo: { messageSecret: crypto.randomBytes(32) },
      interactiveMessage: proto.Message.InteractiveMessage.create({
        header: proto.Message.InteractiveMessage.Header.create({
          title: `${botName} - MENU`,
          subtitle: `Hello, ${userName}`,
          hasMediaAttachment: true,
          ...(thumb ? { locationMessage: { jpegThumbnail: thumb } } : {}),
        }),
        body: proto.Message.InteractiveMessage.Body.create({
          text: grey.body,
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({
          text: grey.footer,
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
          buttons: [
            {
              name: 'single_select',
              buttonParamsJson: JSON.stringify({
                title: 'OPEN FULL MENU',
                sections: [
                  {
                    title: 'DOWNLOAD MENU',
                    highlight_label: 'HOT',
                    rows: [
                      { header: 'TIKTOK', title: 'Tiktok Downloader', description: '', id: `${p}tiktok` },
                      { header: 'YT', title: 'Youtube Audio', description: '', id: `${p}play` },
                      { header: 'IG', title: 'Instagram', description: '', id: `${p}ig` },
                    ],
                  },
                  {
                    title: 'ALL MENU',
                    highlight_label: 'NEXORA',
                    rows: [
                      { header: 'DOWNLOAD', title: 'Download Menu', description: '', id: `${p}help download` },
                      { header: 'GROUP', title: 'Group Menu', description: '', id: `${p}help group` },
                      { header: 'AI', title: 'AI Menu', description: '', id: `${p}help ai` },
                    ],
                  },
                ],
              }),
            },
            ...(channelUrl ? [{
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({ display_text: `${channel.name || 'NEXORA'} Channel`, url: channelUrl }),
            }] : []),
          ],
        }),
      }),
    }, { ...(sock.user?.id ? { userJid: sock.user.id } : {}) });

    try {
      await sock.relayMessage(m.from, msg.message, { messageId: msg.key.id });
    } catch (err) {
      console.warn('[MENU photoFlowMenu] card failed, falling back to text:', err.message);
      await sock.sendMessage(m.from, { text: buildTextFallback(menuData) }, { quoted: m });
    }

    // Photo of the person who requested it — shrunk so it downloads instead
    // of hanging, and tagged by username/phone (never the LID).
    if (pp) {
      let photoBuf = null;
      try { photoBuf = await shrinkImage(await fetchBuffer(pp), 1024, 80); } catch (_) {}
      if (photoBuf) {
        await sock.sendMessage(m.from, {
          image: photoBuf,
          caption: `This is your photo ${chipLabel}`,
          mentions: [chipJid],
        }, { quoted: m });
      } else {
        await sock.sendMessage(m.from, {
          image: { url: pp },
          caption: `This is your photo ${chipLabel}`,
          mentions: [chipJid],
        }, { quoted: m });
      }
    }
  },
};

export default photoFlowMenu;

/**
 * startCard.js — the "Start chatting" card, two renderings.
 *
 * Reference: the zapo-js cards (`FionyBot/JH-Zapo`, `jobasfernandes/
 * zapo-interactive-examples`). zapo-js itself ships no button helper — bots
 * build the proto by hand — and its own examples use three families:
 *   legacy   buttonsMessage (often inside documentWithCaptionMessage), whose
 *            RESPONSE buttons paint as solid green pills
 *   quick    interactiveMessage + nativeFlowMessage quick_reply buttons
 *   cta      interactiveMessage + nativeFlowMessage cta_url / cta_call / cta_copy
 *
 * A single button of either native-flow family renders as one wide button
 * under the body, which is the look in the reference screenshot. Two variants
 * live here so the device decides:
 *
 *   card     header image + body + footer + one native-flow button
 *   contact  a real vCard contact message; WhatsApp itself paints the green
 *            "Start chatting" action bar on it, which no bot can build
 */
import { Button } from './moonsonKit.js';
import { ASSET_URLS } from '../assets/assetUrls.js';
import brand from '../../config/brand.js';
import owner from '../../config/owner.js';
import { brandVcard } from './brandContact.js';

function resolveNumber(sock, phone) {
  const explicit = (phone || '').replace(/[^0-9]/g, '');
  if (explicit && !/^0+$/.test(explicit)) return explicit;
  const session = (sock?.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
  if (session) return session;
  const cfg = (owner.ownerNumber || '').replace(/[^0-9]/g, '');
  return /^0+$/.test(cfg) ? '' : cfg;
}

/**
 * Header image + body + footer + a single green button.
 * @param {object} sock
 * @param {string} jid
 * @param {object} opts
 * @param {string} [opts.body]
 * @param {string} [opts.footer]
 * @param {string} [opts.title]
 * @param {string} [opts.label='💬 Start chatting']
 * @param {'cta_url'|'quick_reply'|'legacy'} [opts.kind='cta_url']
 * @param {string} [opts.phone]     Number the CTA opens
 * @param {string} [opts.url]       Override the CTA target
 * @param {string} [opts.image]     Header image URL (defaults to the menu banner)
 * @param {string} [opts.replyId='start'] Id the quick_reply variant sends back
 * @param {object} [opts.quoted]
 */
export async function sendStartCard(sock, jid, {
  body,
  footer,
  title,
  label = '💬 Start chatting',
  kind = 'cta_url',
  phone,
  url,
  image = ASSET_URLS.menuBanner,
  replyId = 'start',
  quoted,
} = {}) {
  const number = resolveNumber(sock, phone);
  const name = brand.display?.name || brand.name;
  const target = url || (number ? `https://wa.me/${number}` : '');

  if (kind === 'legacy') {
    const { baileysBridge } = await import('../core/baileysBridge.js');
    return baileysBridge.sendButtonsCard(sock, jid, {
      body: body || `» *${name}*\n  › Nice to meet you.`,
      footer: footer || `© ${name}`,
      title: title || name,
      subtitle: brand.display?.tagline || brand.tagline,
      buttons: [{ displayText: label, id: 'start', type: 1 }],
      thumbnail: image,
    }, quoted ? { quoted } : {});
  }

  const card = new Button(sock)
    .setTitle(title || name)
    .setBody(body || `» *${name}*\n  › Nice to meet you.`)
    .setFooter(footer || `© ${name}`);

  if (image) card.setImage(image);

  if (kind === 'quick_reply') {
    card.addButton('quick_reply', { display_text: label, id: replyId });
  } else {
    if (!target) throw new Error('startCard: no number or url for the CTA');
    card.addButton('cta_url', {
      display_text: label,
      url: target,
      merchant_url: target,
      webview_interaction: false,
    });
  }

  return card.send(jid, quoted ? { quoted } : {});
}

/**
 * A real vCard contact message for the bot itself. WhatsApp renders the
 * contact bubble and paints its own green action bar under it.
 */
export async function sendStartContact(sock, jid, {
  displayName,
  phone,
  quoted,
} = {}) {
  const number = resolveNumber(sock, phone);
  const name = displayName || brand.display?.name || brand.name;
  const vcard = brandVcard({ botName: name, phone: number });
  return sock.sendMessage(jid, {
    contacts: {
      displayName: name,
      contacts: [{ vcard }],
    },
  }, quoted ? { quoted } : {});
}

export default sendStartCard;

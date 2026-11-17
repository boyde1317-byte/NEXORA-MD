/**
 * brandContact.js — the green contact bubble.
 *
 * A synthetic `contactMessage` quoted context: the bubble paints as a contact
 * card (avatar from the vcard waid, the bot's name underneath) instead of a
 * replied-to text. `.brand` has shipped it since the Moonson port; this module
 * exists so every other card can carry the same bubble from one place.
 *
 * The vcard pins the owner's real number as `waid`, so WhatsApp resolves the
 * genuine profile picture rather than a placeholder.
 */
import brand from '../../config/brand.js';
import owner from '../../config/owner.js';
import { buildFakeContactQuote } from './waUtils.js';

/**
 * The bot's vCard, as a vCard string.
 * @param {{ botName?: string, phone?: string }} [opts]
 */
export function brandVcard({ botName, phone } = {}) {
  const name = botName || brand.name;
  const num = (phone || owner.ownerNumber || '').replace(/[^0-9]/g, '');
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${name} Bot`,
    `FN:${name} Bot`,
    `ORG:${name};`,
    `TEL;type=CELL;type=VOICE;waid=${num}:+${num}`,
    'END:VCARD',
  ].join('\r\n');
}

/**
 * A ready-to-use fake quote carrying the brand contact bubble.
 * Pass as `{ quoted: buildBrandContactQuote() }`, or lift `.message` into a
 * `contextInfo.quotedMessage`.
 *
 * @param {{ botName?: string, displayName?: string, phone?: string }} [opts]
 */
export function buildBrandContactQuote({ botName, displayName, phone } = {}) {
  const name = botName || brand.name;
  return buildFakeContactQuote({
    displayName: displayName || (brand.display?.name) || name,
    vcard: brandVcard({ botName: name, phone }),
  });
}

export default buildBrandContactQuote;

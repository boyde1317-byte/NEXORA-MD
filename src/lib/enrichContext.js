/**
 * @file src/lib/enrichContext.js
 *
 * Shared builder for the "enriched contextInfo" visual stack used across
 * all text-only bot replies.  Produces a contextInfo object containing:
 *
 *   1. newsletterAdminInviteMessage quote — gives the reply bar a
 *      "invited to channel" look instead of a bare quoted message.
 *   2. externalAdReply — small link-preview banner with the bot logo
 *      and a source URL, rendered above the message body.
 *
 * Usage:
 *   import { buildEnrichedContextInfo } from '../../lib/enrichContext.js';
 *   await m.reply(text, { contextInfo: buildEnrichedContextInfo() });
 *   // or
 *   await sock.sendMessage(jid, { text, contextInfo: buildEnrichedContextInfo() }, { quoted: m });
 */

import { buildFakeNewsletterQuote } from './waUtils.js';
import { ASSET_URLS } from '../assets/assetUrls.js';
import brand from '../../config/brand.js';

const DEFAULT_SOURCE_URL = 'https://github.com/boyde1317-byte/NEXORA-MD';

/**
 * Build a contextInfo object with newsletter quote + externalAdReply.
 *
 * @param {object} [opts]
 * @param {string} [opts.newsletterName]  Newsletter display name
 * @param {string} [opts.caption]          Newsletter caption text
 * @param {string} [opts.adTitle]         Ad-reply title (default: brand.name)
 * @param {string} [opts.adBody]          Ad-reply body (default: brand.tagline)
 * @param {string} [opts.sourceUrl]       Ad-reply source URL
 * @param {string} [opts.thumbnailUrl]    Ad-reply thumbnail image URL
 * @param {boolean}[opts.renderLargerThumbnail]  Show a larger thumbnail
 * @returns {object} contextInfo suitable for `sock.sendMessage({ text, contextInfo })`
 */
export function buildEnrichedContextInfo({
  newsletterName,
  caption,
  adTitle,
  adBody,
  sourceUrl,
  thumbnailUrl,
  renderLargerThumbnail = false,
} = {}) {
  let contextInfo = {};

  // 1. Newsletter admin invite quote
  try {
    const quote = buildFakeNewsletterQuote({
      newsletterName: newsletterName || `${brand.name} Updates`,
      caption:        caption || brand.tagline || `Made with \u2665\uFE0F By ${brand.creator}`,
    });
    contextInfo = {
      stanzaId:      quote.key.id,
      participant:    quote.key.participant,
      remoteJid:      quote.key.remoteJid,
      quotedMessage:  quote.message,
    };
  } catch (_) {
    // fall through — externalAdReply still works without a quote
  }

  // 2. externalAdReply thumbnail banner
  contextInfo.externalAdReply = {
    title:                  adTitle  || brand.name,
    body:                   adBody   || brand.tagline || `By ${brand.creator}`,
    sourceUrl:              sourceUrl || DEFAULT_SOURCE_URL,
    mediaType:              1,
    renderLargerThumbnail:  renderLargerThumbnail,
    showAdAttribution:      false,
    thumbnailUrl:           thumbnailUrl || ASSET_URLS.thumbnail,
  };

  return contextInfo;
}

export default buildEnrichedContextInfo;

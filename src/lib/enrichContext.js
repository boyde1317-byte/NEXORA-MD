/**
 * @file src/lib/enrichContext.js
 *
 * Shared builder for the "enriched contextInfo" visual stack used across
 * all text-only bot replies.  Produces a contextInfo object containing:
 *
 *   1. newsletterAdminInviteMessage quote — gives the reply bar a
 *      "invited to channel" look instead of a bare quoted message.
 *      (Gated on config.features.newsletters — skipped silently if disabled.)
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
import { config } from '../../config/index.js';
import brand from '../../config/brand.js';

const DEFAULT_SOURCE_URL = 'https://github.com/boyde1317-byte/NEXORA-MD';

/**
 * Build a contextInfo object with newsletter quote + externalAdReply.
 *
 * Respects feature flags:
 *   - config.features.newsletters  → controls whether the fake newsletter quote is included
 *   - config.features.adReplyCards → controls whether the externalAdReply card is included
 *
 * If BOTH are disabled, returns an empty object (so the caller's text still sends fine).
 *
 * @param {object} [opts]
 * @param {string} [opts.newsletterName]  Newsletter display name
 * @param {string} [opts.caption]          Newsletter caption text
 * @param {string} [opts.adTitle]         Ad-reply title (default: brand.name or config.adReply.title)
 * @param {string} [opts.adBody]          Ad-reply body (default: brand.tagline or config.adReply.body)
 * @param {string} [opts.sourceUrl]       Ad-reply source URL (default: config.adReply.sourceUrl or GitHub)
 * @param {string} [opts.thumbnailUrl]    Ad-reply thumbnail image URL (default: config.adReply.thumbnailUrl or ASSET_URLS.thumbnail)
 * @param {boolean}[opts.renderLargerThumbnail]  Show a larger thumbnail (default: config.adReply.renderLargerThumbnail)
 * @returns {object} contextInfo suitable for `sock.sendMessage({ text, contextInfo })`
 */
export function buildEnrichedContextInfo({
  newsletterName,
  caption,
  adTitle,
  adBody,
  sourceUrl,
  thumbnailUrl,
  renderLargerThumbnail,
} = {}) {
  let contextInfo = {};

  // 1. Newsletter admin invite quote (gated on feature flag)
  if (config.features?.newsletters !== false) {
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
  }

  // 2. externalAdReply thumbnail banner (gated on feature flag)
  if (config.features?.adReplyCards !== false) {
    const adConfig = config.adReply || {};
    contextInfo.externalAdReply = {
      title:                  adTitle  || adConfig.title  || brand.name,
      body:                   adBody   || adConfig.body   || brand.tagline || `By ${brand.creator}`,
      sourceUrl:              sourceUrl || adConfig.sourceUrl || DEFAULT_SOURCE_URL,
      mediaType:              1,
      renderLargerThumbnail:  renderLargerThumbnail ?? adConfig.renderLargerThumbnail ?? false,
      showAdAttribution:      false,
      thumbnailUrl:           thumbnailUrl || adConfig.thumbnailUrl || ASSET_URLS.thumbnail,
    };
  }

  return contextInfo;
}

export default buildEnrichedContextInfo;

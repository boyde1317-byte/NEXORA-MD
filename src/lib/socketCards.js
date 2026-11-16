/**
 * socketCards.js — rich result rendering for the socket-feature commands
 * (username, spam reporting, registration).
 *
 * Tiered rendering, best surface first:
 *   1. AIRich — markdown (bold title + native table + tips + follow-up
 *      pills) painted as a Meta-AI-style rich response.
 *   2. richTableCard — native table card, with its own ASCII fallback.
 *   3. Plain text — for text-only results, when both rich tiers are off.
 * Usage and error replies stay plain text; cards are for results.
 */
import { sendAIRichReply } from './aiRichReply.js';
import { richTableCard } from './interactiveKit.js';

const escapeCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * Render a result: bold title, optional text, a Field/Value table and an
 * optional code block, through AIRich first and richTableCard second.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.text]      Extra line under the title.
 * @param {Array<[string, string]>} [opts.rows]
 * @param {string} [opts.code]      Fenced block after the table (AIRich tier only).
 * @param {string} [opts.footer]
 * @param {string[]} [opts.tips]    AIRich metadata lines.
 * @param {string[]} [opts.suggest] AIRich follow-up pills (command strings).
 * @param {object[]} [opts.buttons] richTableCard fallback buttons.
 */
export async function sendSocketResult(sock, jid, m, { title, text, rows = [], code, footer = 'NEXORA', tips = [], suggest = [], buttons = [] }) {
  const lines = [`*${title}*`];
  if (text) lines.push('', text);
  if (rows.length) {
    lines.push('', '| Field | Value |', '| --- | --- |', ...rows.map(([k, v]) => `| ${escapeCell(k)} | ${escapeCell(v)} |`));
  }
  if (code) lines.push('', '```', code, '```');
  const markdown = lines.join('\n');
  const richSent = await sendAIRichReply(sock, jid, m, { markdown, tips, suggest, footer });
  if (richSent) return true;
  if (rows.length) {
    await richTableCard(sock, jid, { title, headers: ['Field', 'Value'], rows, footer, buttons }, { quoted: m });
  } else {
    await m.reply(markdown);
  }
  return true;
}

/**
 * Taken-username result, shared by .checkusername and .setusername.
 * Suggestion pills re-run the caller's own command against a suggestion.
 */
export async function sendUsernameTakenCard(sock, jid, m, prefix, username, result, action = 'checkusername') {
  const rows = [
    ['Username', `@${username}`],
    ['Status', '❌ Taken'],
  ];
  if (result?.rejectionReasons?.length) rows.push(['Reason', result.rejectionReasons.join(', ')]);
  const suggestions = (result?.suggestions || []).slice(0, 5);
  for (const suggestion of suggestions) rows.push(['Suggestion', `@${suggestion}`]);
  return await sendSocketResult(sock, jid, m, {
    title: '🔎 USERNAME CHECK',
    rows,
    suggest: suggestions.slice(0, 3).map(s => `${prefix || '.'}${action} ${s}`),
  });
}

/**
 * Nexora MD — Global Response Style Guide
 *
 * Defines the bot's conversational identity. Every system message the bot sends
 * (errors, cooldowns, permission denials, success confirmations) draws from
 * these pools so the persona stays consistent across all 14 menu types and
 * every plugin.
 *
 * Design principles:
 *   • One accent symbol per message (✦ ⚡ ☕ ❖ 🪐 ∘) — never emoji soup
 *   • Confident, calm, slightly witty — not robotic, not over-friendly
 *   • Short. One line. The user already knows what happened.
 *   • Smallcaps reserved for menu headers, not inline responses
 *
 * Usage:
 *   import { getRandomResponse } from '../nexora-messages.js';
 *   reply(getRandomResponse('success'));
 */

export const nexoraResponses = {
  // ── Success & Confirmations ────────────────────────────────────────────
  success: [
    "Done. ✦",
    "Finished. You're good to go. ☕",
    "All set. ⚡",
    "Handled. ❖",
    "Saved and secured. ✦",
    "That's taken care of. ☕",
  ],

  // ── Errors & Failures ──────────────────────────────────────────────────
  error: [
    "Ran into an issue there. Let's try again. ✦",
    "Something interrupted the process. ⚡",
    "Couldn't quite get that done. ⨯",
    "That didn't work as expected. Check your formatting. ✦",
    "System hit a snag. Care to try again? ☕",
  ],

  // ── Warnings & Missing Inputs ──────────────────────────────────────────
  warning: [
    "Something isn't quite right here. ⚆",
    "You might want to double-check that. ✦",
    "I need a bit more info to run this. ☕",
    "Careful — that's not quite right. ⚡",
  ],

  // ── Loading & Processing ──────────────────────────────────────────────
  loading: [
    "Give me a moment... ∘",
    "Processing that. ☕",
    "Pulling the data now... ✦",
    "Working on it. ⚡",
    "Just a second... ∘",
  ],

  // ── Permissions & Access Control ──────────────────────────────────────
  permission_denied: [
    "You don't have the clearance for this. ❖",
    "That's above your access level, I'm afraid. ☕",
    "I can only run this for admins. ✦",
    "Nice try — but you lack the permissions for this one. ⚡",
  ],

  owner_only: [
    "Owner access required for this. ✦",
    "Only my creator can authorize that. ⚡",
    "System locked to owner protocol. ❖",
  ],

  // ── Group Moderation ──────────────────────────────────────────────────
  group_only: "This command works in group chats only. ✦",
  private_only: "Let's keep this between us. Use it in private chat. ☕",
  bot_not_admin: "I need admin privileges to do that. Promote me first. ⚡",

  moderation: {
    kick: "Peace restored. ☕",
    promote: "Welcome to the top. ✦",
    demote: "Back to the ranks. ⚡",
    mute: "Group is locked. Quiet time. ❖",
    unmute: "Group is open. Play nice, everyone. ✦",
    antilink: "Caught an unauthorized link. Handled. ⚡",
  },

  // ── Owner Specific ────────────────────────────────────────────────────
  owner: {
    wake: "Welcome back. What's on the agenda? ☕",
    shutdown: "Going dark. See you soon. ✦",
    update: "Applying updates. System is yours. ⚡",
  },

  // ── Cooldown ──────────────────────────────────────────────────────────
  cooldown: [
    (cmd, time) => `⏳ \`${cmd}\` is cooling down. Try again in *${time}*.`,
    (cmd, time) => `Slow down — \`${cmd}\` needs *${time}* more. ⚡`,
    (cmd, time) => `Give it *${time}* — \`${cmd}\` is on cooldown. ☕`,
  ],

  // ── Command Not Found ─────────────────────────────────────────────────
  not_found: [
    (cmd) => `Couldn't find \`${cmd}\`. Check the spelling? ✦`,
    (cmd) => `\`${cmd}\` isn't a command I know. ☕`,
    (cmd) => `No match for \`${cmd}\`. Try \`.help\` for the full list. ⚡`,
  ],

  // ── Command Execution Error ───────────────────────────────────────────
  exec_error: [
    (cmd, err) => `⨯ \`${cmd}\` hit an unexpected error.\n_${err}_\n\nIf this keeps happening, contact the owner.`,
    (cmd, err) => `Something went wrong running \`${cmd}\`.\n_${err}_\n\nTry again, or reach out if it persists. ✦`,
  ],

  // ── Utilities ─────────────────────────────────────────────────────────
  utility: {
    ping: (ms) => `Running smooth. Speed: ${ms}ms. ⚡`,
    download: "File retrieved. 📥",
  },
};

/**
 * Pull a varied, non-repetitive response.
 * Supports both string arrays and function arrays (for dynamic messages).
 *
 * @param {string} category — response category key
 * @param {...any} args — arguments to pass if the response is a function
 * @returns {string}
 */
export function getRandomResponse(category, ...args) {
  const responses = nexoraResponses[category];

  if (!responses) return 'Handled. ✦';

  // Single string
  if (typeof responses === 'string') return responses;

  // Array of strings or functions
  if (Array.isArray(responses)) {
    const idx = Math.floor(Math.random() * responses.length);
    const picked = responses[idx];
    if (typeof picked === 'function') return picked(...args);
    return picked;
  }

  // Object (e.g., moderation, owner, utility)
  if (typeof responses === 'object') return JSON.stringify(responses);

  return 'Handled. ✦';
}

export default { nexoraResponses, getRandomResponse };

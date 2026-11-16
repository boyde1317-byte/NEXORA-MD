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
 * Voice treatments (from the .styletext font maps):
 *   • Italic — confirmations, notices, and the bot's everyday voice
 *   • Bold lead word — errors and access denials, so they scan fast
 *   • Plain — templates carrying WhatsApp markup, and emoji-led lines
 *
 * Usage:
 *   import { getRandomResponse } from '../nexora-messages.js';
 *   reply(getRandomResponse('success'));
 */

export const nexoraResponses = {
  // ── Success & Confirmations ────────────────────────────────────────────
  success: [
    "𝘋𝘰𝘯𝘦. ✦",
    "𝘍𝘪𝘯𝘪𝘴𝘩𝘦𝘥. 𝘠𝘰𝘶'𝘳𝘦 𝘨𝘰𝘰𝘥 𝘵𝘰 𝘨𝘰. ☕",
    "𝘈𝘭𝘭 𝘴𝘦𝘵. ⚡",
    "𝘏𝘢𝘯𝘥𝘭𝘦𝘥. ❖",
    "𝘚𝘢𝘷𝘦𝘥 𝘢𝘯𝘥 𝘴𝘦𝘤𝘶𝘳𝘦𝘥. ✦",
    "𝘛𝘩𝘢𝘵'𝘴 𝘵𝘢𝘬𝘦𝘯 𝘤𝘢𝘳𝘦 𝘰𝘧. ☕",
    "𝘓𝘰𝘤𝘬𝘦𝘥 𝘪𝘯. 🪐",
    "𝘚𝘮𝘰𝘰𝘵𝘩 𝘭𝘪𝘬𝘦 𝘣𝘶𝘵𝘵𝘦𝘳. 𝘋𝘰𝘯𝘦. ∘",
    "𝘊𝘰𝘯𝘴𝘪𝘥𝘦𝘳 𝘪𝘵 𝘩𝘢𝘯𝘥𝘭𝘦𝘥. ✦",
    "𝘔𝘪𝘴𝘴𝘪𝘰𝘯 𝘢𝘤𝘤𝘰𝘮𝘱𝘭𝘪𝘴𝘩𝘦𝘥. ☕",
  ],

  // ── Errors & Failures ──────────────────────────────────────────────────
  error: [
    "𝗥𝗮𝗻 into an issue there. Let's try again. ✦",
    "𝗦𝗼𝗺𝗲𝘁𝗵𝗶𝗻𝗴 interrupted the process. ⚡",
    "𝗖𝗼𝘂𝗹𝗱𝗻'𝘁 quite get that done. ⨯",
    "𝗧𝗵𝗮𝘁 didn't work as expected. Check your formatting. ✦",
    "𝗦𝘆𝘀𝘁𝗲𝗺 hit a snag. Care to try again? ☕",
    "𝗬𝗲𝗮𝗵... that didn't cooperate. Give it another shot. ⚡",
    "𝗧𝗵𝗲 bot gods are displeased. Try again. 🪐",
  ],

  // ── Warnings & Missing Inputs ──────────────────────────────────────────
  warning: [
    "𝘚𝘰𝘮𝘦𝘵𝘩𝘪𝘯𝘨 𝘪𝘴𝘯'𝘵 𝘲𝘶𝘪𝘵𝘦 𝘳𝘪𝘨𝘩𝘵 𝘩𝘦𝘳𝘦. ⚆",
    "𝘠𝘰𝘶 𝘮𝘪𝘨𝘩𝘵 𝘸𝘢𝘯𝘵 𝘵𝘰 𝘥𝘰𝘶𝘣𝘭𝘦-𝘤𝘩𝘦𝘤𝘬 𝘵𝘩𝘢𝘵. ✦",
    "𝘐 𝘯𝘦𝘦𝘥 𝘢 𝘣𝘪𝘵 𝘮𝘰𝘳𝘦 𝘪𝘯𝘧𝘰 𝘵𝘰 𝘳𝘶𝘯 𝘵𝘩𝘪𝘴. ☕",
    "𝘊𝘢𝘳𝘦𝘧𝘶𝘭 — 𝘵𝘩𝘢𝘵'𝘴 𝘯𝘰𝘵 𝘲𝘶𝘪𝘵𝘦 𝘳𝘪𝘨𝘩𝘵. ⚡",
    "𝘏𝘰𝘭𝘥 𝘰𝘯 — 𝘴𝘰𝘮𝘦𝘵𝘩𝘪𝘯𝘨'𝘴 𝘮𝘪𝘴𝘴𝘪𝘯𝘨. ∘",
    "𝘕𝘰𝘵 𝘲𝘶𝘪𝘵𝘦. 𝘛𝘢𝘬𝘦 𝘢𝘯𝘰𝘵𝘩𝘦𝘳 𝘭𝘰𝘰𝘬 𝘢𝘵 𝘵𝘩𝘢𝘵. ❖",
  ],

  // ── Loading & Processing ──────────────────────────────────────────────
  loading: [
    "𝘎𝘪𝘷𝘦 𝘮𝘦 𝘢 𝘮𝘰𝘮𝘦𝘯𝘵... ∘",
    "𝘗𝘳𝘰𝘤𝘦𝘴𝘴𝘪𝘯𝘨 𝘵𝘩𝘢𝘵. ☕",
    "𝘗𝘶𝘭𝘭𝘪𝘯𝘨 𝘵𝘩𝘦 𝘥𝘢𝘵𝘢 𝘯𝘰𝘸... ✦",
    "𝘞𝘰𝘳𝘬𝘪𝘯𝘨 𝘰𝘯 𝘪𝘵. ⚡",
    "𝘑𝘶𝘴𝘵 𝘢 𝘴𝘦𝘤𝘰𝘯𝘥... ∘",
    "𝘊𝘳𝘶𝘯𝘤𝘩𝘪𝘯𝘨 𝘵𝘩𝘦 𝘯𝘶𝘮𝘣𝘦𝘳𝘴... 🪐",
    "𝘍𝘦𝘵𝘤𝘩𝘪𝘯𝘨 𝘵𝘩𝘢𝘵 𝘧𝘰𝘳 𝘺𝘰𝘶... ☕",
  ],

  // ── Permissions & Access Control ──────────────────────────────────────
  permission_denied: [
    "𝗬𝗼𝘂 don't have the clearance for this. ❖",
    "𝗧𝗵𝗮𝘁'𝘀 above your access level, I'm afraid. ☕",
    "𝗜 can only run this for admins. ✦",
    "𝗡𝗶𝗰𝗲 try — but you lack the permissions for this one. ⚡",
    "𝗧𝗵𝗶𝘀 one's locked behind admin access. 🪐",
  ],

  owner_only: [
    "𝗢𝘄𝗻𝗲𝗿 access required for this. ✦",
    "𝗢𝗻𝗹𝘆 my creator can authorize that. ⚡",
    "𝗦𝘆𝘀𝘁𝗲𝗺 locked to owner protocol. ❖",
    "𝗧𝗵𝗮𝘁'𝘀 a creator-only command. No shortcuts here. 🪐",
  ],

  // ── Group Moderation ──────────────────────────────────────────────────
  group_only: "𝘛𝘩𝘪𝘴 𝘤𝘰𝘮𝘮𝘢𝘯𝘥 𝘸𝘰𝘳𝘬𝘴 𝘪𝘯 𝘨𝘳𝘰𝘶𝘱 𝘤𝘩𝘢𝘵𝘴 𝘰𝘯𝘭𝘺. ✦",
  private_only: "𝘓𝘦𝘵'𝘴 𝘬𝘦𝘦𝘱 𝘵𝘩𝘪𝘴 𝘣𝘦𝘵𝘸𝘦𝘦𝘯 𝘶𝘴. 𝘜𝘴𝘦 𝘪𝘵 𝘪𝘯 𝘱𝘳𝘪𝘷𝘢𝘵𝘦 𝘤𝘩𝘢𝘵. ☕",
  bot_not_admin: "𝘐 𝘯𝘦𝘦𝘥 𝘢𝘥𝘮𝘪𝘯 𝘱𝘳𝘪𝘷𝘪𝘭𝘦𝘨𝘦𝘴 𝘵𝘰 𝘥𝘰 𝘵𝘩𝘢𝘵. 𝘗𝘳𝘰𝘮𝘰𝘵𝘦 𝘮𝘦 𝘧𝘪𝘳𝘴𝘵. ⚡",

  moderation: {
    kick: "𝘗𝘦𝘢𝘤𝘦 𝘳𝘦𝘴𝘵𝘰𝘳𝘦𝘥. ☕",
    promote: "𝘞𝘦𝘭𝘤𝘰𝘮𝘦 𝘵𝘰 𝘵𝘩𝘦 𝘵𝘰𝘱. ✦",
    demote: "𝘉𝘢𝘤𝘬 𝘵𝘰 𝘵𝘩𝘦 𝘳𝘢𝘯𝘬𝘴. ⚡",
    mute: "𝘎𝘳𝘰𝘶𝘱 𝘪𝘴 𝘭𝘰𝘤𝘬𝘦𝘥. 𝘘𝘶𝘪𝘦𝘵 𝘵𝘪𝘮𝘦. ❖",
    unmute: "𝘎𝘳𝘰𝘶𝘱 𝘪𝘴 𝘰𝘱𝘦𝘯. 𝘗𝘭𝘢𝘺 𝘯𝘪𝘤𝘦, 𝘦𝘷𝘦𝘳𝘺𝘰𝘯𝘦. ✦",
    antilink: "𝘊𝘢𝘶𝘨𝘩𝘵 𝘢𝘯 𝘶𝘯𝘢𝘶𝘵𝘩𝘰𝘳𝘪𝘻𝘦𝘥 𝘭𝘪𝘯𝘬. 𝘏𝘢𝘯𝘥𝘭𝘦𝘥. ⚡",
  },

  // ── Owner Specific ────────────────────────────────────────────────────
  owner: {
    wake: "𝘞𝘦𝘭𝘤𝘰𝘮𝘦 𝘣𝘢𝘤𝘬. 𝘞𝘩𝘢𝘵'𝘴 𝘰𝘯 𝘵𝘩𝘦 𝘢𝘨𝘦𝘯𝘥𝘢? ☕",
    shutdown: "𝘎𝘰𝘪𝘯𝘨 𝘥𝘢𝘳𝘬. 𝘚𝘦𝘦 𝘺𝘰𝘶 𝘴𝘰𝘰𝘯. ✦",
    update: "𝘈𝘱𝘱𝘭𝘺𝘪𝘯𝘨 𝘶𝘱𝘥𝘢𝘵𝘦𝘴. 𝘚𝘺𝘴𝘵𝘦𝘮 𝘪𝘴 𝘺𝘰𝘶𝘳𝘴. ⚡",
  },

  // ── Cooldown ──────────────────────────────────────────────────────────
  cooldown: [
    (cmd, time) => `⏳ \`${cmd}\` is cooling down. Try again in *${time}*.`,
    (cmd, time) => `Slow down — \`${cmd}\` needs *${time}* more. ⚡`,
    (cmd, time) => `Give it *${time}* — \`${cmd}\` is on cooldown. ☕`,
    (cmd, time) => `Patience. \`${cmd}\` will be ready in *${time}*. 🪐`,
    (cmd, time) => `Not yet — *${time}* left on \`${cmd}\`'s cooldown. ∘`,
  ],

  // ── Command Not Found ─────────────────────────────────────────────────
  not_found: [
    (cmd) => `Couldn't find \`${cmd}\`. Check the spelling? ✦`,
    (cmd) => `\`${cmd}\` isn't a command I know. ☕`,
    (cmd) => `No match for \`${cmd}\`. Try \`.help\` for the full list. ⚡`,
    (cmd) => `\`${cmd}\`? That's not in my vocabulary. 🪐`,
    (cmd) => `I searched high and low — \`${cmd}\` doesn't exist. ❖`,
  ],

  // ── Command Execution Error ───────────────────────────────────────────
  exec_error: [
    (cmd, err) => `⨯ \`${cmd}\` hit an unexpected error.\n_${err}_\n\nIf this keeps happening, contact the owner.`,
    (cmd, err) => `Something went wrong running \`${cmd}\`.\n_${err}_\n\nTry again, or reach out if it persists. ✦`,
    (cmd, err) => `\`${cmd}\` stumbled. Here's what happened:\n_${err}_\n\nGive it another shot. ⚡`,
  ],

  // ── Welcome / Onboarding ──────────────────────────────────────────────
  welcome: [
    (name) => `𝘏𝘦𝘺 @${name} — 𝘐'𝘮 𝘢𝘸𝘢𝘬𝘦 𝘢𝘯𝘥 𝘳𝘦𝘢𝘥𝘺. ☕`,
    (name) => `𝘞𝘦𝘭𝘤𝘰𝘮𝘦 𝘢𝘣𝘰𝘢𝘳𝘥, @${name}. 𝘓𝘦𝘵'𝘴 𝘨𝘦𝘵 𝘺𝘰𝘶 𝘴𝘵𝘢𝘳𝘵𝘦𝘥. ✦`,
    (name) => `𝘈𝘩, 𝘢 𝘯𝘦𝘸 𝘧𝘢𝘤𝘦. 𝘏𝘪 @${name} — 𝘐'𝘷𝘦 𝘨𝘰𝘵 𝘺𝘰𝘶 𝘤𝘰𝘷𝘦𝘳𝘦𝘥. ⚡`,
    (name) => `@${name} 𝘫𝘶𝘴𝘵 𝘥𝘳𝘰𝘱𝘱𝘦𝘥 𝘪𝘯. 𝘞𝘦𝘭𝘤𝘰𝘮𝘦 — 𝘐'𝘮 𝘢𝘭𝘭 𝘺𝘰𝘶𝘳𝘴. 🪐`,
  ],

  // ── Daily Reward ──────────────────────────────────────────────────────
  daily_claimed: [
    "𝘙𝘦𝘸𝘢𝘳𝘥 𝘴𝘦𝘤𝘶𝘳𝘦𝘥. 𝘚𝘦𝘦 𝘺𝘰𝘶 𝘵𝘰𝘮𝘰𝘳𝘳𝘰𝘸. ☕",
    "𝘊𝘰𝘪𝘯𝘴 𝘪𝘯 𝘵𝘩𝘦 𝘣𝘢𝘨. 𝘋𝘰𝘯'𝘵 𝘣𝘳𝘦𝘢𝘬 𝘵𝘩𝘦 𝘴𝘵𝘳𝘦𝘢𝘬! ✦",
    "𝘊𝘭𝘢𝘪𝘮𝘦𝘥. 𝘠𝘰𝘶𝘳 𝘸𝘢𝘭𝘭𝘦𝘵 𝘢𝘱𝘱𝘳𝘦𝘤𝘪𝘢𝘵𝘦𝘴 𝘺𝘰𝘶. ⚡",
    "𝘕𝘪𝘤𝘦 — 𝘵𝘩𝘢𝘵'𝘴 𝘢𝘯𝘰𝘵𝘩𝘦𝘳 𝘥𝘢𝘺 𝘭𝘰𝘤𝘬𝘦𝘥 𝘪𝘯. 🪐",
    "𝘚𝘰𝘳𝘵𝘦𝘥. 𝘊𝘰𝘮𝘦 𝘣𝘢𝘤𝘬 𝘴𝘢𝘮𝘦 𝘵𝘪𝘮𝘦 𝘵𝘰𝘮𝘰𝘳𝘳𝘰𝘸. ∘",
  ],

  daily_streak_max: [
    "Maximum streak! You're unstoppable. 🔥",
    "30 days. Legendary discipline. 👑",
    "Max streak achieved — the bot gods are impressed. 🪐",
  ],

  // ── Level Up ──────────────────────────────────────────────────────────
  level_up: [
    (level) => `𝘓𝘦𝘷𝘦𝘭 ${level}! 𝘙𝘪𝘴𝘪𝘯𝘨 𝘵𝘩𝘳𝘰𝘶𝘨𝘩 𝘵𝘩𝘦 𝘳𝘢𝘯𝘬𝘴. ⚡`,
    (level) => `𝘠𝘰𝘶 𝘩𝘪𝘵 𝘓𝘦𝘷𝘦𝘭 ${level}. 𝘕𝘪𝘤𝘦𝘭𝘺 𝘥𝘰𝘯𝘦. ✦`,
    (level) => `𝘓𝘦𝘷𝘦𝘭 ${level} 𝘶𝘯𝘭𝘰𝘤𝘬𝘦𝘥. 𝘒𝘦𝘦𝘱 𝘤𝘭𝘪𝘮𝘣𝘪𝘯𝘨. 🪐`,
    (level) => `𝘉𝘰𝘰𝘮 — 𝘓𝘦𝘷𝘦𝘭 ${level}! 𝘛𝘩𝘦 𝘨𝘳𝘪𝘯𝘥 𝘱𝘢𝘺𝘴 𝘰𝘧𝘧. ☕`,
  ],

  // ── Ping ──────────────────────────────────────────────────────────────
  ping_fast: [
    (ms) => `⚡ ${ms}ms — faster than your reflexes.`,
    (ms) => `${ms}ms. Basically instant. ☕`,
    (ms) => `🪐 ${ms}ms — lightspeed.`,
  ],
  ping_normal: [
    (ms) => `🏓 ${ms}ms — quick enough.`,
    (ms) => `${ms}ms. Running smooth. ✦`,
    (ms) => `⚡ ${ms}ms — no lag in sight.`,
  ],
  ping_slow: [
    (ms) => `☕ ${ms}ms... I'm awake, I promise.`,
    (ms) => `${ms}ms. The server's having a moment. ⚡`,
    (ms) => `🪐 ${ms}ms — fashionably late.`,
  ],

  // ── Utilities ─────────────────────────────────────────────────────────
  utility: {
    ping: (ms) => `Running smooth. Speed: ${ms}ms. ⚡`,
    download: "𝘍𝘪𝘭𝘦 𝘳𝘦𝘵𝘳𝘪𝘦𝘷𝘦𝘥. 📥",
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

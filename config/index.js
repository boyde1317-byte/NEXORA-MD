import brand from './brand.js';

/**
 * Parse owner phone numbers from the OWNER_NUMBERS environment variable.
 * Numbers must be comma-separated, include country code, no + or spaces.
 *
 * SECURITY: Owner numbers are read from env only — no hardcoded fallback
 * phone numbers in source. If env is unset, an empty array is returned and
 * the bot will have no owner (all owner-only commands will be inaccessible
 * until OWNER_NUMBERS is set in .env).
 */
function parseOwnerNumbers() {
  const raw = process.env.OWNER_NUMBERS;
  if (raw && raw.trim()) {
    return raw.split(',').map(n => n.trim().replace(/[^0-9]/g, '')).filter(Boolean);
  }
  // No hardcoded fallback — owner must be configured via .env
  console.warn('[CONFIG] OWNER_NUMBERS not set in environment. Owner-only commands will be unavailable until configured.');
  return [];
}

export const config = {
  botName: brand.name,
  owner: parseOwnerNumbers(),
  prefix: ["!", ".", "/"],
  pairing: {
    enabled: true,
    phoneNumber: process.env.PAIRING_PHONE || "",
  },
  sessionPath: "./session",
  reconnectLimit: 5,
  cooldownTime: 1500,
  autoRead: true,
  publicMode: true,
  dbPath: "./src/database/db.json",
  channelJid: process.env.CHANNEL_JID || "120363406397452589@newsletter",

  // XP / leveling system
  xp: {
    perMessageMin: 5,
    perMessageMax: 15,
    messageCooldownMs: 60000,
    levelUpAnnounce: true,
    levelUpCoinBonus: 50,
  },
};

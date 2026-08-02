import brand from './brand.js';

function parseOwnerNumbers() {
  const raw = process.env.OWNER_NUMBERS;
  if (raw && raw.trim()) {
    return raw.split(',').map(n => n.trim().replace(/[^0-9]/g, '')).filter(Boolean);
  }
  // Fallback defaults — should be overridden via .env
  return ["233597514499", "233533416608"];
}

export const config = {
  botName: brand.name,
  owner: parseOwnerNumbers(),
  prefix: ["!", ".", "/"],
  pairing: {
    enabled: true,
    phoneNumber: process.env.PAIRING_PHONE || "233597514499",
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

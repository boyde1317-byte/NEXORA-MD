import brand from './brand.js';

export const config = {
  botName: brand.name,
  owner: ["233597514499", "233533416608"], // Owner phone numbers without @s.whatsapp.net
  prefix: ["!", ".", "/"],
  pairing: {
    enabled: true, // Set to true to use pairing code, false for QR code terminal
    phoneNumber: "233597514499" // Default phone number for pairing code (must include country code, e.g., 44xxx or 1xxx)
  },
  sessionPath: "./session",
  reconnectLimit: 5,
  cooldownTime: 1500, // 1.5 seconds default command cooldown
  autoRead: true, // Auto-read incoming messages
  publicMode: true, // True = public bot, False = owner-only commands
  dbPath: "./src/database/db.json",
  channelJid: "120363406397452589@newsletter", // WhatsApp Channel JID for newsletter menu type

  // XP / leveling system
  xp: {
    perMessageMin: 5,        // Minimum XP awarded per eligible message
    perMessageMax: 15,       // Maximum XP awarded per eligible message
    messageCooldownMs: 60000, // 60s cooldown per user per chat before XP can be earned again
    levelUpAnnounce: true,   // Post a level-up card in the chat when a user levels up from chatting
    levelUpCoinBonus: 50,    // Coins awarded per level gained from chat activity (celebratory bonus)
  },
};

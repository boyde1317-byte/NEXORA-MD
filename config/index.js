import brand from './brand.js';

export const config = {
  botName: brand.name,
  owner: ["233533416608"], // Owner phone numbers without @s.whatsapp.net
  prefix: ["!", ".", "/"],
  pairing: {
    enabled: true, // Set to true to use pairing code, false for QR code terminal
    phoneNumber: "233533416608" // Default phone number for pairing code (must include country code, e.g., 44xxx or 1xxx)
  },
  sessionPath: "./session",
  reconnectLimit: 5,
  cooldownTime: 1500, // 1.5 seconds default command cooldown
  autoRead: true, // Auto-read incoming messages
  publicMode: true, // True = public bot, False = owner-only commands
  dbPath: "./src/database/db.json"
};

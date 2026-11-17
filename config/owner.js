function sanitizeNumber(num) {
  return num ? num.replace(/[^0-9]/g, '') : '';
}

export default {
  ownerName: process.env.OWNER_NAME || "Bot Owner",
  ownerNumber: sanitizeNumber(process.env.PAIRING_PHONE || process.env.OWNER_NUMBERS?.split(',')[0]) || "000000000000",
  developerName: process.env.OWNER_NAME || "Developer",
  // WhatsApp username, used in place of the phone number where a menu points
  // people at the owner's chat (no number on show).
  ownerUsername: (process.env.OWNER_USERNAME || "moonson3").replace(/^@/, ""),
};

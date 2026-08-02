export default {
  ownerName: process.env.OWNER_NAME || "Aizen",
  ownerNumber: process.env.PAIRING_PHONE || process.env.OWNER_NUMBERS?.split(',')[0]?.trim() || "233533416608",
  developerName: process.env.OWNER_NAME || "Aizen",
};

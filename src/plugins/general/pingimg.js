/**
 * pingimg.js — .pingimg — ping as a relayed fixed image.
 *
 * Ported from LUNA MD plugins/ping2.js as-is.
 *
 * NOTE: the image is a hardcoded mmg.whatsapp.net signed URL (with oh/oe
 * expiry params) copied from the original — it WILL stop loading once
 * that signature expires, and the message carries a spoofed quoted
 * contact. There is no live function here beyond relaying that image;
 * the house .ping / .ping3 commands are the real latency checks.
 *
 * Differences from the original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 *   - The hardcoded messageSecret is now a fresh crypto.randomBytes(32)
 *     per send (house HTML-scene pattern).
 *   - DROPPED: `handler.customPrefix = /./` — the original fired on
 *     EVERY message. NexoraFlex has no customPrefix support; this is a
 *     normal prefixed command now.
 */
import crypto from 'node:crypto';

export default {
  name: 'pingimg',
  aliases: [],
  category: 'general',
  description: 'Ping as a relayed image (fixed image from the original).',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    await sock.relayMessage(
      m.from,
      {
        imageMessage: {
          url: 'https://mmg.whatsapp.net/o1/v/t24/f2/m235/AQMbzsUTYqoTXzIL3N7DfDf_Gj5ofYJDa1HTRhfLxm3xaddw5h-NwC-kjZRoLST1mH9si8vr_3G1AtqrO47BqrR1b62Q3_4oGBVazOujxg?ccb=9-4&oh=01_Q5Aa5wF92priPjNoMHUh1HOdIKwxd9HqF-xnxewOvn1_gA8fCw&oe=6AE9E669&_nc_sid=e6ed6c&mms3=true',
          mimetype: 'image/jpeg',
          fileSha256: 'tYH5QoKPGhdtYJJf/YKPMYgWMjpAEc5es0Kf1VOWa0c=',
          fileLength: 26871,
          height: 700,
          width: 1000,
          mediaKey: 'ekeAWKSXeIuOtNYJA3HzVIs+rLMzgH3fjKn5rzTAab0=',
          fileEncSha256: 'seHypuIFS1TmLdyNVqN5nIATlkxGPSNA1gRT2Yqtm9c=',
          directPath: '/o1/v/t24/f2/m235/AQMbzsUTYqoTXzIL3N7DfDf_Gj5ofYJDa1HTRhfLxm3xaddw5h-NwC-kjZRoLST1mH9si8vr_3G1AtqrO47BqrR1b62Q3_4oGBVazOujxg?ccb=9-4&oh=01_Q5Aa5wF92priPjNoMHUh1HOdIKwxd9HqF-xnxewOvn1_gA8fCw&oe=6AE9E669&_nc_sid=e6ed6c',
          mediaKeyTimestamp: 1791132383,
          jpegThumbnail: '/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAWACADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAECBv/EACMQAAICAgECBwAAAAAAAAAAAAERAAISITFRgRMiMkFSYZH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDi8q+FWuFH8luZ0j6fyUZGteUukB4lNe+tTSIE94iLLEhVP2pavLT7CS3BgD5a1O+OsC9dsE94iBk26MQRZHcRIP/Z',
          contextInfo: {
            stanzaId: 'StatusBiz',
            participant: '0@s.whatsapp.net',
            quotedMessage: {
              contactMessage: {
                displayName: 'ᄃӨПƧӨᄂΣ.ᄂӨ𝑮("𝑰𝑴Λ𝑮𝑰ПΣ!?")',
                vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:ᄃӨПƧӨᄂΣ.ᄂӨ𝑮("𝑰𝑴Λ𝑮𝑰ПΣ!?") 𝑴𝒖𝒍𝒕𝒊𝒅𝒆𝒗𝒊𝒄𝒆\nFN:ᄃӨПƧӨᄂΣ.ᄂӨ𝑮("𝑰𝑴Λ𝑮𝑰ПΣ!?") 𝑴𝒖𝒍𝒕𝒊𝒅𝒆𝒗𝒊𝒄𝒆\nORG:ᄃӨПƧӨᄂΣ.ᄂӨG("IMΛGIПΣ!?");\nTEL;type=CELL;type=VOICE;waid=13135550002:+13135550002\nEND:VCARD',
              },
            },
            remoteJid: 'status@broadcast',
          },
        },
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32),
        },
      },
      {
        additionalAttributes: {
          expiration: '7776000',
        },
      }
    );
  },
};

/**
 * runcrm.js — .runcrm (reply to a relay.js file) — run a saved CRM payload.
 *
 * Ported from the LUNA MD runcrm plugin (luna-md/plugins/runcrm.js),
 * which was CommonJS (require/module.exports). This is the ESM port:
 * the temp file is still loaded with require(), via createRequire —
 * the faithful equivalent, since a dynamic ESM import cannot load a
 * CJS `module.exports = {...}` relay file.
 *
 * Differences from the LUNA original:
 *   - `satanic` -> `sock`, `m.chat` -> `m.from`, `isCreator` is gone
 *     (owner-only is enforced by permissions: { owner: true }).
 *   - The temp file no longer lands in process.cwd()/temp: it goes to
 *     os.tmpdir() under a random nexora-crm-<ts>-<rand>.js name, and is
 *     always unlinked (success or failure).
 *   - The quoted file is downloaded with Baileys' downloadMediaMessage
 *     from the quoted message's fakeObj (the house shape for a raw
 *     WebMessageInfo), instead of the LUNA-only downloadMediaMessage
 *     helper on the connection object.
 *   - The relay file itself is owner-supplied code executed via
 *     require(), exactly as the original did — owner-only by design,
 *     and it only runs a file the owner deliberately replies to.
 *
 * Expected file: a relay.js module exporting { payload, createdAt,
 * creator }, as produced by the CRM export flow. The payload may
 * carry buttons, a raw message, or plain text.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { downloadMediaMessage } from 'baileys';

const require = createRequire(import.meta.url);

export default {
  name: 'runcrm',
  aliases: [],
  category: 'owner',
  description: 'Run a saved CRM relay file (owner only). Reply to the relay.js file, then send .runcrm',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';

    if (!m.quoted) {
      return m.reply(
        `⚠️ *How to use:*\n\n` +
        `Reply to the *relay.js* file that was created, then send *${p}runcrm*\n\n` +
        `📌 Example: Reply to the relay.js file then type ${p}runcrm`
      );
    }

    const quoted = m.quoted;
    const fileName = quoted?.message?.documentMessage?.fileName
      || quoted?.msg?.documentMessage?.fileName
      || '';
    const mimetype = quoted?.message?.documentMessage?.mimetype
      || quoted?.mimetype
      || '';
    const isDocument = mimetype === 'application/javascript'
      || fileName === 'relay.js'
      || fileName.endsWith('.js')
      || !!quoted?.message?.documentMessage
      || !!quoted?.msg?.documentMessage;

    if (!isDocument) {
      return m.reply(
        `❌ Not a valid file!\n\n` +
        `📌 Reply to the *relay.js* file sent by the bot`
      );
    }

    const tempFile = path.join(
      os.tmpdir(),
      `nexora-crm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.js`
    );

    try {
      const downloadTarget = quoted?.fakeObj || quoted;
      const media = await downloadMediaMessage(downloadTarget, 'buffer', {});
      if (!media?.length) {
        return m.reply('❌ Failed to download the file');
      }

      const fileContent = media.toString('utf8');
      let crmData;
      try {
        fs.writeFileSync(tempFile, fileContent);
        crmData = require(tempFile);
      } catch (e) {
        return m.reply(`❌ Failed to parse CRM:\n${e.message}`);
      } finally {
        try { fs.unlinkSync(tempFile); } catch (_) {}
      }

      if (!crmData || !crmData.payload) {
        return m.reply('❌ Invalid CRM or empty payload');
      }

      const payload = crmData.payload;

      if (payload.hasButtons && payload.buttonData) {
        const buttonMsg = {
          text: payload.buttonData.contentText || payload.text || '',
          footer: payload.buttonData.footerText || '',
          buttons: payload.buttonData.buttons || [],
          headerType: payload.buttonData.headerType || 6,
        };
        if (payload.locationData) {
          buttonMsg.location = payload.locationData;
        }
        await sock.sendMessage(m.from, buttonMsg, { quoted: m });
      } else if (payload.rawMessage && Object.keys(payload.rawMessage).length > 0) {
        await sock.sendMessage(m.from, payload.rawMessage, { quoted: m });
      } else if (payload.text) {
        await sock.sendMessage(m.from, { text: payload.text }, { quoted: m });
      } else {
        return m.reply('❌ No content to send from the CRM');
      }

      await sock.sendMessage(m.from, {
        react: { text: '✅', key: m.key },
      });

      let infoText = `✅ *CRM ran successfully*\n\n`;
      infoText += `📅 Created: ${crmData.createdAt || 'Unknown'}\n`;
      infoText += `👤 Creator: ${crmData.creator || 'Unknown'}\n`;
      infoText += `📝 Type: ${payload.type || 'Unknown'}\n`;
      infoText += `🔘 Button: ${payload.hasButtons ? '✅ Yes' : '❌ No'}\n`;
      if (payload.hasLocation) {
        infoText += `📍 Location: ✅ Yes\n`;
      }

      await sock.sendMessage(m.from, { text: infoText }, { quoted: m });
    } catch (e) {
      console.error('RUNCRM ERROR:', e);
      return m.reply(
        '❌ Failed to run the CRM.\n\n' +
        (e?.message || String(e))
      );
    } finally {
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (_) {}
    }
  },
};

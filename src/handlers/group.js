import fs from 'fs';
import { db } from '../database/db.js';
import { assetManager } from '../assets/assetManager.js';
import brand from '../../config/brand.js';

/**
 * Gets the display name for a participant
 */
async function getDisplayName(sock, jid) {
  try {
    const contact = await sock.onWhatsApp(jid.split('@')[0]);
    return contact?.[0]?.notify || jid.split('@')[0];
  } catch {
    return jid.split('@')[0];
  }
}

/**
 * Handles group participant events: join (welcome) and leave (goodbye)
 */
export async function handleGroupParticipantsUpdate(update, sock) {
  try {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants?.length) return;

    const groupSettings = db.getGroup(groupJid);

    if (action === 'add' && groupSettings.welcome) {
      for (const participant of participants) {
        try {
          const name = await getDisplayName(sock, participant);
          const welcomeText = [
            `╭─「 Welcome 」`,
            `│`,
            `│ 👋 Welcome to the group, @${participant.split('@')[0]}!`,
            `│`,
            `│ We're glad to have you here.`,
            `│`,
            `╰─ ${brand.name} • ${brand.signature}`
          ].join('\n');

          const imagePath = assetManager.getAsset('welcome');
          const imageBuffer = typeof imagePath === 'string' && imagePath.startsWith('http')
            ? null
            : (fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null);

          if (imageBuffer) {
            await sock.sendMessage(groupJid, {
              image: imageBuffer,
              caption: welcomeText,
              mentions: [participant]
            });
          } else {
            await sock.sendMessage(groupJid, {
              text: welcomeText,
              mentions: [participant]
            });
          }
        } catch (err) {
          console.error(`[GROUP] Failed to send welcome for ${participant}:`, err.message);
        }
      }
    }

    if (action === 'remove' && groupSettings.goodbye) {
      for (const participant of participants) {
        try {
          const goodbyeText = [
            `╭─「 Goodbye 」`,
            `│`,
            `│ 👋 @${participant.split('@')[0]} has left the group.`,
            `│`,
            `│ We'll miss you!`,
            `│`,
            `╰─ ${brand.name} • ${brand.signature}`
          ].join('\n');

          const imagePath = assetManager.getAsset('goodbye');
          const imageBuffer = typeof imagePath === 'string' && imagePath.startsWith('http')
            ? null
            : (fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null);

          if (imageBuffer) {
            await sock.sendMessage(groupJid, {
              image: imageBuffer,
              caption: goodbyeText,
              mentions: [participant]
            });
          } else {
            await sock.sendMessage(groupJid, {
              text: goodbyeText,
              mentions: [participant]
            });
          }
        } catch (err) {
          console.error(`[GROUP] Failed to send goodbye for ${participant}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[GROUP] Error in handleGroupParticipantsUpdate:', err.message || err);
  }
}

export default handleGroupParticipantsUpdate;

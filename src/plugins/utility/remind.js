import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { db } from '../../database/db.js';

const MAX_MINUTES = 1440;
const activeReminders = new Map();

function parseTime(str) {
  const m = str.match(/^(\d+(?:\.\d+)?)(m|min|h|hr|s|sec)?$/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = (m[2] || 'm').toLowerCase();
  if (unit.startsWith('h')) return val * 60;
  if (unit.startsWith('s')) return val / 60;
  return val;
}

/**
 * Persist active reminders to the database so they survive restarts.
 * Called after every add/cancel/fire operation.
 */
function syncRemindersToDb() {
  try {
    const serializable = {};
    for (const [id, r] of activeReminders) {
      serializable[id] = {
        sender: r.sender,
        message: r.message,
        fireAt: r.fireAt,
        jid: r.jid,
      };
    }
    db.setSettings({ activeReminders: serializable });
  } catch (err) {
    console.error('[REMIND] Failed to persist reminders:', err.message);
  }
}

/**
 * Restore reminders from the database on startup / after reconnect.
 * Only re-arms reminders that haven't fired yet (fireAt > now).
 */
export function restoreReminders(sock) {
  try {
    const stored = db.getSettings().activeReminders;
    if (!stored || typeof stored !== 'object') return;

    const now = Date.now();
    for (const [id, r] of Object.entries(stored)) {
      const delay = r.fireAt - now;
      if (delay <= 0) continue; // already expired — skip

      const timeout = setTimeout(async () => {
        activeReminders.delete(id);
        syncRemindersToDb();
        try {
          await sock.sendMessage(r.jid, {
            text: `⏰ *REMINDER* [${id}]\n\n${r.message}\n\n_Set by @${r.sender.split('@')[0]}_`,
            mentions: [r.sender],
          });
        } catch (_) {}
      }, delay);

      activeReminders.set(id, { ...r, timeout });
    }

    if (activeReminders.size > 0) {
      console.log(`[REMIND] Restored ${activeReminders.size} active reminder(s) from database.`);
    }
  } catch (err) {
    console.error('[REMIND] Failed to restore reminders:', err.message);
  }
}

export default {
  name: 'remind',
  aliases: ['reminder', 'remindme', 'timer'],
  category: 'utility',
  description: 'Sets a personal reminder. Usage: .remind <time> <message>\nTime: 10m, 1h, 30s etc. Max 24h.',
  cooldown: 2000,
  execute: async ({ m, sock, args, sender, prefix }) => {
    const p = prefix || '.';
    if (args[0]?.toLowerCase() === 'list') {
      const userReminders = [...activeReminders.entries()]
        .filter(([, r]) => r.sender === sender)
        .map(([id, r]) => {
          const remaining = Math.ceil((r.fireAt - Date.now()) / 60000);
          return `• [${id}] ${remaining}m left — ${r.message.slice(0, 40)}`;
        });

      if (!userReminders.length) {
        return await m.reply.info('You have no active reminders.', 'REMINDERS');
      }
      return await m.reply(asciiBuilder.box('YOUR REMINDERS', userReminders));
    }

    if (args[0]?.toLowerCase() === 'cancel' && args[1]) {
      const id = args[1].toUpperCase();
      const r = activeReminders.get(id);
      if (!r || r.sender !== sender) {
        return await m.reply.error(`No reminder found with ID *${id}*.`);
      }
      clearTimeout(r.timeout);
      activeReminders.delete(id);
      syncRemindersToDb();
      return await m.reply.success(`Reminder *${id}* cancelled.`);
    }

    const timeStr = args[0];
    const message = args.slice(1).join(' ').trim();

    if (!timeStr || !message) {
      return await m.reply.info(
        `Usage: \`${p}remind <time> <message>\`\n\nExamples:\n• \`${p}remind 10m Take a break\`\n• \`${p}remind 1h Check the oven\`\n• \`${p}remind 30s Drink water\`\n\nCommands:\n• \`${p}remind list\` — see active reminders\n• \`${p}remind cancel <id>\` — cancel a reminder`,
        'REMINDER'
      );
    }

    const minutes = parseTime(timeStr);
    if (minutes === null || minutes <= 0) {
      return await m.reply.error('Invalid time format. Examples: `10m`, `1h`, `30s`');
    }
    if (minutes > MAX_MINUTES) {
      return await m.reply.error(`Maximum reminder time is 24 hours (1440 minutes).`);
    }

    const id = Math.random().toString(36).slice(2, 7).toUpperCase();
    const fireAt = Date.now() + minutes * 60000;
    const displayTime = minutes >= 60
      ? `${(minutes / 60).toFixed(1)}h`
      : minutes < 1 ? `${Math.round(minutes * 60)}s` : `${Math.round(minutes)}m`;

    const timeout = setTimeout(async () => {
      activeReminders.delete(id);
      syncRemindersToDb();
      try {
        await sock.sendMessage(m.from, {
          text: `⏰ *REMINDER* [${id}]\n\n${message}\n\n_Set by @${sender.split('@')[0]}_`,
          mentions: [sender],
        });
      } catch (_) {}
    }, minutes * 60000);

    activeReminders.set(id, { sender, message, fireAt, timeout, jid: m.from });
    syncRemindersToDb();

    await m.reply(asciiBuilder.box('⏰ REMINDER SET', [
      `🆔 ID      : ${id}`,
      `⏱️  Time    : ${displayTime} from now`,
      `📝 Message : ${message.length > 50 ? message.slice(0, 47) + '...' : message}`,
      ``,
      `Use \`${p}remind cancel ${id}\` to cancel.`,
    ]));
  }
};

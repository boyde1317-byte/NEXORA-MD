import { withReactionStatus } from '../../lib/cosmetics.js';
import { messageFormatter } from '../../ui/messageFormatter.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

const MAX_WARNINGS = 3;

export default {
  name: 'warn',
  aliases: ['warning', 'strike'],
  category: 'group',
  description: 'Warn a group member. At 3 warnings the user is kicked automatically.',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 3000,
  execute: async ({ m, sock, args, db, config }) => {
    const sub = args[0]?.toLowerCase();

    if (sub === 'reset' || sub === 'clear') {
      let target = null;
      if (m.quoted) target = m.quoted.sender;
      else if (m.msg?.contextInfo?.mentionedJid?.length) target = m.msg.contextInfo.mentionedJid[0];
      else if (args[1]) {
        const n = args[1].replace(/[^0-9]/g, '');
        if (n) target = `${n}@s.whatsapp.net`;
      }
      if (!target) return await m.reply.error('Reply to or mention the user to reset warnings for.');
      db.setUser(target, { warnings: 0 });
      // NOTE: { mentions: [target] } is intentionally passed as second arg to messageFormatter.success()
      // (where it is silently ignored) to preserve existing behavior — the mention is embedded in
      // the text only, not sent as a WhatsApp mention. Do not migrate to m.reply.success() here.
      return await m.reply(messageFormatter.success(`Warnings reset for @${target.split('@')[0]}.`, { mentions: [target] }));
    }

    let target = null;
    if (m.quoted) target = m.quoted.sender;
    else if (m.msg?.contextInfo?.mentionedJid?.length) target = m.msg.contextInfo.mentionedJid[0];
    else if (args[0] && /^\d+$/.test(args[0].replace(/[^0-9]/g, ''))) {
      const n = args[0].replace(/[^0-9]/g, '');
      if (n) target = `${n}@s.whatsapp.net`;
    }

    if (!target) {
      return await m.reply.info(
        'Usage:\n• `!warn @user [reason]` — add a warning\n• `!warn reset @user` — clear all warnings\n\nAt *3 warnings* the user is automatically kicked from the group.',
        'WARN SYSTEM'
      );
    }

    const targetNum = target.split('@')[0].split(':')[0];
    const botNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    if (targetNum === botNum) return await m.reply.error('Cannot warn the bot itself.');
    if (config.owner.includes(targetNum)) return await m.reply.error('Cannot warn the bot owner.');

    const reason = (sub && sub !== 'reset' ? args.join(' ') : args.slice(1).join(' ')).trim() || 'No reason provided';
    const userData = db.getUser(target);
    const newCount = (userData.warnings ?? 0) + 1;
    db.setUser(target, { warnings: newCount });

    await withReactionStatus(m, async () => {
      if (newCount >= MAX_WARNINGS) {
        try {
          await sock.groupParticipantsUpdate(m.from, [target], 'remove');
          await m.reply(
            asciiBuilder.box('⚠️ USER KICKED', [
              `👤 User    : @${targetNum}`,
              `⚠️  Warnings: ${newCount}/${MAX_WARNINGS}`,
              `📝 Reason  : ${reason}`,
              ``,
              `User was automatically removed for reaching the warning limit.`,
            ]) , { mentions: [target] }
          );
          db.setUser(target, { warnings: 0 });
        } catch (err) {
          await m.reply.error(`Could not kick user after ${MAX_WARNINGS} warnings: ${err.message}`);
        }
      } else {
        await m.reply(
          asciiBuilder.box('⚠️ WARNING ISSUED', [
            `👤 User    : @${targetNum}`,
            `⚠️  Strike  : ${newCount}/${MAX_WARNINGS}`,
            `📝 Reason  : ${reason}`,
            ``,
            newCount === MAX_WARNINGS - 1
              ? `⚡ *Final warning!* One more and they will be kicked.`
              : `${MAX_WARNINGS - newCount} more warning(s) before automatic kick.`,
          ]), { mentions: [target] }
        );
      }
    });
  }
};

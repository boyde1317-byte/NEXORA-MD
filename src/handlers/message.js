import { config } from '../../config/index.js';
import { client } from '../core/client.js';
import { db } from '../database/db.js';
import { serialize } from '../core/serializer.js';

/**
 * Checks if a raw JID belongs to the bot owner.
 */
function isOwnerJid(jid) {
  if (!jid) return false;
  const number = jid.split('@')[0].split(':')[0];
  return config.owner.some(o => o === number);
}

/**
 * Main incoming message handler — full command pipeline.
 */
export async function handleMessage(rawMessage, sock) {
  try {
    // Fast-path: skip messages with no content or no destination
    if (!rawMessage?.message) return;
    if (!rawMessage?.key?.remoteJid) return;

    // Skip protocol messages immediately (key rotations, receipts, etc.)
    if (rawMessage.message.protocolMessage) return;
    if (rawMessage.message.senderKeyDistributionMessage) return;

    // Build the rich serialized message object
    const m = await serialize(rawMessage, sock);
    if (!m) return;

    const body      = m.body ?? '';
    const jid       = m.from;
    const sender    = m.sender;
    const isGroupMsg = m.isGroup;

    // Auto-read
    if (config.autoRead) {
      await sock.readMessages([rawMessage.key]).catch(() => {});
    }

    // Only respond to prefixed commands
    const prefix = config.prefix.find(p => body.startsWith(p));
    if (!prefix) return;

    const args        = body.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const resolvedName = client.aliases.get(commandName) || commandName;
    const command      = client.commands.get(resolvedName);
    if (!command) return;

    // ── Permission flags ──────────────────────────────────────────────────
    const perms          = command.permissions || {};
    const ownerOnly      = perms.owner      ?? command.ownerOnly      ?? false;
    const groupOnly      = perms.groupOnly  ?? command.groupOnly      ?? false;
    const adminOnly      = perms.admin      ?? command.adminOnly      ?? false;
    const botAdminRequired = perms.botAdmin ?? command.botAdmin       ?? false;

    const ownerCheck = isOwnerJid(sender);

    // 1. Owner-only guard
    if (ownerOnly && !ownerCheck) {
      await sock.sendMessage(jid, {
        text: `❌ This command is restricted to the bot owner only.`
      }, { quoted: rawMessage });
      return;
    }

    // 2. Private mode guard
    if (!config.publicMode && !ownerCheck) {
      await sock.sendMessage(jid, {
        text: `🔒 This bot is running in private mode. Only the owner can use commands.`
      }, { quoted: rawMessage });
      return;
    }

    // 3. Group-only guard
    if (groupOnly && !isGroupMsg) {
      await sock.sendMessage(jid, {
        text: `❌ This command can only be used in groups.`
      }, { quoted: rawMessage });
      return;
    }

    // 4. Admin guard (sender must be a group admin)
    if (adminOnly && isGroupMsg) {
      const senderIsAdmin = await m.isAdmin();
      if (!senderIsAdmin && !ownerCheck) {
        await sock.sendMessage(jid, {
          text: `❌ This command requires group admin privileges.`
        }, { quoted: rawMessage });
        return;
      }
    }

    // 5. Bot-admin guard (bot itself must be a group admin)
    if (botAdminRequired && isGroupMsg) {
      const botIsAdmin = await m.isBotAdmin();
      if (!botIsAdmin) {
        await sock.sendMessage(jid, {
          text: `❌ I need to be a group admin to use this command.`
        }, { quoted: rawMessage });
        return;
      }
    }

    // 6. Cooldown enforcement
    const now         = Date.now();
    const cooldownKey = `${sender}_${resolvedName}`;
    const cooldownMs  = command.cooldown ?? config.cooldownTime;
    const lastUsed    = client.cooldowns.get(cooldownKey);

    if (lastUsed && now - lastUsed < cooldownMs) {
      const remaining = ((cooldownMs - (now - lastUsed)) / 1000).toFixed(1);
      await sock.sendMessage(jid, {
        text: `⏳ Please wait ${remaining}s before using that command again.`
      }, { quoted: rawMessage });
      return;
    }

    client.cooldowns.set(cooldownKey, now);
    setTimeout(() => client.cooldowns.delete(cooldownKey), cooldownMs);

    // 7. Database ban check
    const userData = db.getUser(sender);
    if (userData?.banned) {
      await sock.sendMessage(jid, {
        text: `🚫 You have been banned from using this bot.`
      }, { quoted: rawMessage });
      return;
    }

    // ── Build context for plugin execute() ───────────────────────────────
    const ctx = {
      m,
      sock,
      jid,
      sender,
      args,
      body,
      prefix,
      isGroup: isGroupMsg,
      isOwner: ownerCheck,
      rawMessage,
      db,
      client,
      config,
      reply: m.reply,
      react: m.react
    };

    await command.execute(ctx);
    console.log(`[CMD] ${command.name} ← ${sender.split('@')[0]} in ${isGroupMsg ? jid : 'DM'}`);

  } catch (err) {
    console.error('[HANDLER ERROR] handleMessage crashed:', err.message || err);
  }
}

export default handleMessage;

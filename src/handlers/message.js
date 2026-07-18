import { config } from '../../config/index.js';
    import { client } from '../core/client.js';
    import { db } from '../database/db.js';
    import { serialize } from '../core/serializer.js';
    import { checkStickerCommand } from '../lib/stickerCommand.js';
    import { asciiBuilder } from '../ui/asciiBuilder.js';
    import { MASS_MENTION_THRESHOLD } from '../plugins/group/antitag.js';
    import { formatDuration } from '../lib/utils.js';
    import {
      grantXp,
      canGainMessageXp,
      randomMessageXp,
      rankBadge,
      streakEmoji,
      progressBar,
      getLevelProgress,
    } from '../economy/leveling.js';
    import { getDisplayName } from '../lib/displayName.js';
    import { getRandomResponse } from '../nexora-messages.js';

    /**
    * Passive XP-from-activity: every real, non-command, non-bot message earns
    * the sender a small random amount of XP, gated by a per-user/per-chat
    * cooldown so a spam burst can't be farmed for levels. Runs for every
    * message (including ones that also happen to be commands) since the
    * user is still "active" either way.
    */
    async function awardMessageXp(m, sock) {
      try {
        if (m.fromMe || m.from === 'status@broadcast') return;
        const userData = db.getUser(m.sender);
        if (userData?.banned) return;
        if (!canGainMessageXp(client, m.sender, m.from)) return;

        const result = grantXp(db, m.sender, { xp: randomMessageXp() });
        if (!result.leveledUp || !config.xp.levelUpAnnounce) return;

        // Celebratory coin bonus on top of the xp itself — leveling up from
        // chat activity should feel as rewarding as claiming `!daily`.
        const coinBonus = result.levelsGained * config.xp.levelUpCoinBonus;
        const bonusResult = coinBonus > 0 ? grantXp(db, m.sender, { coins: coinBonus }) : result;

        const progress = getLevelProgress(bonusResult.after.xp);
        const bar = progressBar(progress.xpIntoLevel, progress.nextLevelXp - progress.currentLevelXp);
        const streak = userData.streak ?? 0;
        const name = await getDisplayName(sock, m.sender);
        const number = m.sender.split('@')[0].split(':')[0];

        const lines = [
          `🎊 @${number} (${name}) just leveled up!`,
          ``,
          `🏅 New Level : ${bonusResult.after.level}`,
          `🎖️  Rank      : ${rankBadge(bonusResult.after.level)}`,
          `✨ Total XP  : ${bonusResult.after.xp.toLocaleString()}`,
          `📊 Progress  : ${bar}`,
          `   Next lvl : ${progress.xpToNextLevel.toLocaleString()} XP away`,
          `🪙 Coins     : ${coinBonus > 0 ? `+${coinBonus} bonus → Total ${bonusResult.after.coins.toLocaleString()}` : bonusResult.after.coins.toLocaleString()}`,
          `${streakEmoji(streak)} Streak    : ${streak} day${streak !== 1 ? 's' : ''}`,
        ];

        const text = asciiBuilder.box('🎉 LEVEL UP', lines);

        let ppUrl = null;
        try { ppUrl = await sock.profilePictureUrl(m.sender, 'image'); } catch (_) {}

        if (ppUrl) {
          const res = await fetch(ppUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
          if (res?.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            await sock.sendMessage(m.from, { image: buffer, caption: text, mentions: [m.sender] }, { quoted: m });
            return;
          }
        }

        await m.reply(text, { mentions: [m.sender] });
      } catch (err) {
        console.error('[XP] Failed to award message xp:', err.message || err);
      }
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

      const body = m.body ?? '';
      const jid = m.from;
      const sender = m.sender;
      const isGroupMsg = m.isGroup;

      // ── Passive XP from activity ────────────────────────────────────────────
      // Fire-and-forget: never let xp bookkeeping delay or break command handling.
      awardMessageXp(m, sock);

      // Auto-read
      if (config.autoRead) {
        await sock.readMessages([rawMessage.key]).catch(() => {});
      }

      // ── Anti-link enforcement ───────────────────────────────────────────────
      // Runs before the prefix gate so plain link messages (no command prefix) are caught.
      if (isGroupMsg && !m.fromMe) {
        const groupData = db.getGroup(jid);
        if (groupData?.antilink) {
          const LINK_RE = /(?:https?:\/\/|www\.)|chat\.whatsapp\.com\/\S+|t\.me\/\S+/i;
          if (LINK_RE.test(body)) {
            try {
              const senderIsAdmin = await m.isAdmin();
              if (!senderIsAdmin && !m.isOwner) {
                await sock.sendMessage(jid, { delete: m.key });
                const userData2 = db.getUser(sender);
                const warns = (userData2.warnings ?? 0) + 1;
                db.setUser(sender, { warnings: warns });
                const senderNum = sender.split('@')[0].split(':')[0];
                await sock.sendMessage(jid, {
                  text: `🚫 @${senderNum} Links are not allowed in this group!\n⚠️ Warning ${warns}/3${warns >= 3 ? ' — You have been removed.' : ''}`,
                  mentions: [sender],
                });
                if (warns >= 3) {
                  await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {});
                  db.setUser(sender, { warnings: 0 });
                }
                return;
              }
            } catch (err) {
              console.error('[ANTILINK] Error enforcing anti-link:', err.message);
            }
          }
        }
      }

      // ── Anti-tag (mass-mention) enforcement ─────────────────────────────────
      // Same enforcement shape as anti-link above: runs before the prefix gate
      // so a plain mass-mention message (no command prefix) is still caught.
      if (isGroupMsg && !m.fromMe) {
        const groupData = db.getGroup(jid);
        if (groupData?.antitag) {
          const mentioned = rawMessage.message?.extendedTextMessage?.contextInfo?.mentionedJid
            || m.msg?.contextInfo?.mentionedJid
            || [];
          if (mentioned.length >= MASS_MENTION_THRESHOLD) {
            try {
              const senderIsAdmin = await m.isAdmin();
              if (!senderIsAdmin && !m.isOwner) {
                await sock.sendMessage(jid, { delete: m.key });
                const userData3 = db.getUser(sender);
                const warns = (userData3.warnings ?? 0) + 1;
                db.setUser(sender, { warnings: warns });
                const senderNum = sender.split('@')[0].split(':')[0];
                await sock.sendMessage(jid, {
                  text: `🚫 @${senderNum} Mass-mentioning ${mentioned.length} members at once is not allowed!\n⚠️ Warning ${warns}/3${warns >= 3 ? ' — You have been removed.' : ''}`,
                  mentions: [sender],
                });
                if (warns >= 3) {
                  await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {});
                  db.setUser(sender, { warnings: 0 });
                }
                return;
              }
            } catch (err) {
              console.error('[ANTITAG] Error enforcing anti-tag:', err.message);
            }
          }
        }
      }

      // ── AFK notifications ───────────────────────────────────────────────────
      // Runs before the prefix gate so plain (non-command) mentions/replies
      // still trigger the notice, and any message from an AFK user clears it.
      if (!m.fromMe && body) {
        try {
          const senderData = db.getUser(sender);
          const isAfkCommand = config.prefix.some(p => body.startsWith(p))
            && body.slice(1).trim().split(/\s+/)[0]?.toLowerCase() === 'afk';

          if (senderData.afk?.active && !isAfkCommand) {
            db.setUser(sender, { afk: { active: false } });
            const awayFor = formatDuration(Date.now() - senderData.afk.since);
            await sock.sendMessage(jid, {
              text: `👋 Welcome back @${sender.split('@')[0]}! You were AFK for ${awayFor}.`,
              mentions: [sender],
            }, { quoted: rawMessage }).catch(() => {});
          }

          const mentionedAfk = new Set([
            ...(m.msg?.contextInfo?.mentionedJid || []),
            ...(m.quoted?.sender ? [m.quoted.sender] : []),
          ]);

          for (const jidCandidate of mentionedAfk) {
            if (jidCandidate === sender) continue;
            const targetData = db.getUser(jidCandidate);
            if (targetData.afk?.active) {
              const awayFor = formatDuration(Date.now() - targetData.afk.since);
              await sock.sendMessage(jid, {
                text: `💤 @${jidCandidate.split('@')[0]} is AFK (${awayFor} ago): ${targetData.afk.reason}`,
                mentions: [jidCandidate],
              }, { quoted: rawMessage }).catch(() => {});
            }
          }
        } catch (err) {
          console.error('[AFK] Error handling AFK notification:', err.message);
        }
      }

      // ── Sticker command shortcut ────────────────────────────────────────────
      // Runs before the prefix gate: sticker messages have no text body so they
      // would always be dropped without this check. Unregistered stickers also
      // exit here — no point running the prefix pipeline on a media message.
      if (m.type === 'stickerMessage') {
        const stickerCmd = checkStickerCommand(m);
        if (stickerCmd) {
          const resolvedName = client.aliases.get(stickerCmd) ?? stickerCmd;
          const command = client.commands.get(resolvedName);
          if (command) {
            try {
              await command.execute({
                m, sock, jid, sender,
                args: [], body: '', prefix: '',
                isGroup: isGroupMsg, isOwner: m.isOwner,
                rawMessage, db, client, config,
                reply: m.reply, react: m.react,
              });
              console.log(`[STICKER-CMD] ${command.name} ← ${sender.split('@')[0]} in ${isGroupMsg ? jid : 'DM'}`);
            } catch (err) {
              console.error(`[STICKER-CMD ERROR] ${command.name}:`, err.message || err);
            }
          }
        }
        return;
      }

      // Only respond to prefixed commands
      const prefix = config.prefix.find(p => body.startsWith(p));
      if (!prefix) return;

      const args = body.slice(prefix.length).trim().split(/\s+/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const resolvedName = client.aliases.get(commandName) || commandName;
      const command = client.commands.get(resolvedName);
      if (!command) return;

      // ── Permission flags ────────────────────────────────────────────────────
      const perms = command.permissions || {};
      const ownerOnly = perms.owner ?? command.ownerOnly ?? false;
      const groupOnly = perms.groupOnly ?? command.groupOnly ?? false;
      const adminOnly = perms.admin ?? command.adminOnly ?? false;
      const botAdminRequired = perms.botAdmin ?? command.botAdmin ?? false;

      // Owner status is resolved once, in the serializer, following the real LID↔PN
      // bridge (sock.signalRepository.lidMapping) — do not recompute it here with a
      // raw string comparison, which breaks whenever WhatsApp presents the sender as
      // an opaque LID instead of a phone-number JID.
      const ownerCheck = m.isOwner;

      // 1. Owner-only guard
      if (ownerOnly && !ownerCheck) {
        await m.reply(getRandomResponse('owner_only'));
        return;
      }

      // 2. Private mode guard — publicMode can be toggled at runtime via .self/.public
      // and is persisted in the database, so it must win over the static config default.
      const publicMode = db.getSettings().publicMode ?? config.publicMode;
      if (!publicMode && !ownerCheck) {
        await m.reply.warn('This bot is running in private mode. Only the owner can use commands.');
        return;
      }

      // 3. Group-only guard
      if (groupOnly && !isGroupMsg) {
        await m.reply(getRandomResponse('group_only'));
        return;
      }

      // 4. Admin guard (sender must be a group admin)
      if (adminOnly && isGroupMsg) {
        const senderIsAdmin = await m.isAdmin();
        if (!senderIsAdmin && !ownerCheck) {
          await m.reply(getRandomResponse('permission_denied'));
          return;
        }
      }

      // 5. Bot-admin guard (bot itself must be a group admin)
      if (botAdminRequired && isGroupMsg) {
        const botIsAdmin = await m.isBotAdmin();
        if (!botIsAdmin) {
          await m.reply(getRandomResponse('bot_not_admin'));
          return;
        }
      }

      // 6. Cooldown enforcement
      const now = Date.now();
      const cooldownKey = `${sender}_${resolvedName}`;
      const cooldownMs = command.cooldown ?? config.cooldownTime;
      const lastUsed = client.cooldowns.get(cooldownKey);

      if (lastUsed && now - lastUsed < cooldownMs) {
        const remaining = ((cooldownMs - (now - lastUsed)) / 1000).toFixed(1);
        await m.reply.warn(`Please wait ${remaining}s before using that command again.`);
        return;
      }

      client.cooldowns.set(cooldownKey, now);
      setTimeout(() => client.cooldowns.delete(cooldownKey), cooldownMs);

      // 7. Database ban check
      const userData = db.getUser(sender);
      if (userData?.banned) {
        await m.reply.error('You have been banned from using this bot.');
        return;
      }

      // ── Build context for plugin execute() ─────────────────────────────────
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

      try {
        await command.execute(ctx);
        console.log(`[CMD] ${command.name} ← ${sender.split('@')[0]} in ${isGroupMsg ? jid : 'DM'}`);
      } catch (execErr) {
        console.error(`[CMD ERROR] ${command.name} threw:`, execErr.message || execErr);
        try {
          await m.reply(`❌ *Command Error*\n\n\`${command.name}\` encountered an unexpected error.\n_${execErr.message || 'Unknown error'}_`);
        } catch (_) {}
      }

    } catch (err) {
      console.error('[HANDLER ERROR] handleMessage crashed:', err.message || err);
    }
    }

    export default handleMessage;
    
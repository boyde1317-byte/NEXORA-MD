/**
 * simulate.js — .simulate <welcome|bye|promote|demote> @user — fake a
 * group event so the owner can preview the welcome/bye/promote/demote
 * messages without anyone actually joining, leaving or changing rank.
 *
 * Ported from LUNA MD plugins/owner-simulate.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; owner-only + group-only via permissions.
 *   - The LUNA original called `conn.participantsUpdate({ ..., simulate: true })`
 *     — a Baileys-fork extension that fakes the event server-side. The
 *     NexoraFlex fork's `sock.groupParticipantsUpdate(jid, [...], action)`
 *     has no simulate flag, and calling it for real would actually add /
 *     remove / promote / demote someone — so this port NEVER calls it.
 *   - Instead it re-emits the event on the socket's own emitter
 *     (`sock.ev.emit('group-participants.update', ...)`), which is what
 *     the bot's group-event listener already handles for real events:
 *     the welcome/goodbye/promote/demote handlers run, nobody's
 *     membership changes.
 *
 * NOT VERIFIED: the sparse clone this was staged against has no
 * src/handlers tree, so the group-participants.update listener path
 * could not be confirmed from code. On-device check: run
 * `.simulate welcome @user` in a group and confirm the welcome card
 * fires and the user is NOT actually added/removed. If nothing fires,
 * the listener lives elsewhere and this needs wiring to it.
 */
const ACTIONS = {
  add: 'add',
  invite: 'add',
  welcome: 'add',
  bye: 'remove',
  kick: 'remove',
  leave: 'remove',
  remove: 'remove',
  promote: 'promote',
  demote: 'demote',
};

export default {
  name: 'simulate',
  aliases: [],
  category: 'owner',
  description: 'Preview a group event (welcome/bye/promote/demote) without changing membership. Usage: .simulate welcome @user',
  permissions: { owner: true, groupOnly: true },
  cooldown: 2000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const event = (args[0] || '').toLowerCase();
    if (!event || !ACTIONS[event]) {
      return await m.reply.info(
        `Example:\n${p}simulate welcome @user\n${p}simulate bye @user\n${p}simulate promote @user\n${p}simulate demote @user`,
        'SIMULATE'
      );
    }
    const part = m.mentioned?.[0] || m.quoted?.sender || m.sender;
    const action = ACTIONS[event];
    await m.reply(`*Simulating ${event}...*`);
    try {
      sock.ev?.emit('group-participants.update', {
        id: m.from,
        participants: [part],
        action,
      });
    } catch (err) {
      return await m.reply.error(`Simulation failed: ${err.message}`);
    }
  },
};

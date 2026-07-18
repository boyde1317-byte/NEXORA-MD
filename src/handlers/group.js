import { greetingManager } from '../greetings/greetingManager.js';

/**
 * Routes group participant events to the canonical greeting pipeline.
 *
 * Runtime path (single source of truth):
 *   group-participants.update
 *     → handleGroupParticipantsUpdate   (this file — routing only)
 *     → greetingManager                 (orchestration + milestones + admin alerts)
 *     → greetingRenderer                (queue, style selection, profile pic, audio)
 *     → greetingBuilder                 (placeholder expansion)
 *     → greetingConfig                  (greeting.json — enabled, style, text, image)
 *
 * Toggle commands (.welcome on/off, .goodbye on/off) write to greetingConfig.
 * greetingRenderer checks greetingConfig.enabled / goodbyeEnabled before sending.
 *
 * Admin events (promote / demote) are forwarded to greetingManager so the bot
 * can send formatted alerts — these were previously unhandled.
 */
export async function handleGroupParticipantsUpdate(update, sock) {
  try {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants?.length) return;

    if (action === 'add') {
      for (const participant of participants) {
        await greetingManager.handleJoin(sock, groupJid, participant);
      }
    } else if (action === 'remove') {
      for (const participant of participants) {
        await greetingManager.handleLeave(sock, groupJid, participant);
      }
    } else if (action === 'promote') {
      await greetingManager.handlePromotion(sock, groupJid, participants);
    } else if (action === 'demote') {
      await greetingManager.handleDemotion(sock, groupJid, participants);
    }
  } catch (err) {
    console.error('[GROUP] Error in handleGroupParticipantsUpdate:', err.message || err);
  }
}

export default handleGroupParticipantsUpdate;

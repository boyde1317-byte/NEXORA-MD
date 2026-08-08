import { greetingManager } from '../greetings/greetingManager.js';

/**
 * Routes group participant events.
 *
 * The "greet new user" (welcome) feature has been removed — it was
 * causing spam in groups. Only promote/demote admin alerts remain.
 *
 * Goodbye (handleLeave) is also removed to keep group events quiet.
 */
export async function handleGroupParticipantsUpdate(update, sock) {
  try {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants?.length) return;

    if (action === 'promote') {
      await greetingManager.handlePromotion(sock, groupJid, participants);
    } else if (action === 'demote') {
      await greetingManager.handleDemotion(sock, groupJid, participants);
    }
    // 'add' (new user join) and 'remove' (user left) are intentionally
    // NOT handled — no more welcome/goodbye spam.
  } catch (err) {
    console.error('[GROUP] Error in handleGroupParticipantsUpdate:', err.message || err);
  }
}

export default handleGroupParticipantsUpdate;

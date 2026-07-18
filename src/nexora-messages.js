/**
 * Nexora MD - Global Response Style Guide
 * Drop this configuration file into your bot framework to standardize Nexora's conversational identity.
 * 
 * Usage:
 * import { responses, getRandomResponse } from './nexora-messages';
 * 
 * reply(getRandomResponse('success'));
 */

export const nexoraResponses = {
    // 🟢 Success & Confirmations
    success: [
        "Done. Everything's in place. ✦",
        "Finished. You're good to go. ☕",
        "Wrapped that up for you. ⚡",
        "All set. ❖",
        "Saved and secured. 🪐",
        "Handled it. ✦"
    ],

    // 🔴 Errors & Failures
    error: [
        "I ran into a slight issue here. Let's try again. 🍂",
        "Something interrupted the process... ⚆",
        "I couldn't quite get that done. ⨯",
        "That didn't work out as expected. Check your command formatting. ✦",
        "System hit a snag. Care to try again? 🍷"
    ],

    // 🟡 Warnings & Missing Inputs
    warning: [
        "Just a heads up, something isn't right here... ⚆",
        "You might want to double-check this. ✦",
        "Careful there. ⚡",
        "I need a bit more info to run this command. ☕"
    ],

    // ⏳ Loading & Processing
    loading: [
        "Give me a moment... ∘",
        "Processing that for you. ☕",
        "Pulling the data now... ✧",
        "Working on it. ⚡",
        "Just a second... ✦"
    ],

    // 🚫 Permissions & Access Control
    permission_denied: [
        "You don't have the clearance for this. 🪐",
        "That's above your paygrade, I'm afraid. 🍷",
        "I can only run this for admins. ❖",
        "Nice try, but you lack the permissions. 🍂"
    ],
    owner_only: [
        "Owner access required for this one. ✦",
        "Only my creator can authorize that. ⚡",
        "System locked to owner protocol. ❖"
    ],

    // 👥 Group Moderation
    group_only: "This command is designed for group chats only. 🪐",
    private_only: "Let's keep this between us. Use this in private chat. ☕",
    bot_not_admin: "I need Admin privileges to do that. Promote me first. ⚡",

    moderation: {
        kick: "Peace restored. ☕",
        promote: "Welcome to the top. ✦",
        demote: "Back to the ranks. 🍂",
        mute: "Group is locked. Quiet time. 🌙",
        unmute: "Group is open. Play nice, everyone. ✦",
        antilink: "Caught an unauthorized link. Handled it. ⚡"
    },

    // 👑 Owner specific
    owner: {
        wake: "Welcome back. What's on the agenda? ☕",
        shutdown: "Going dark. See you soon. 🌙",
        update: "Applying the latest updates. System is yours. ⚡"
    },

    // 🛠️ Utilities
    utility: {
        ping: (ms) => `Running smooth. Speed: ${ms}ms. ⚡`,
        download: "File retrieved. 📥"
    }
};

/**
 * Helper function to pull a varied, non-repetitive response.
 * @param category The category of the response (e.g., 'success', 'error', 'loading')
 * @returns A randomized response string fitting the Nexora personality
 */
export function getRandomResponse(category){
    const responses = nexoraResponses[category];
    
    if (Array.isArray(responses)) {
        const randomIndex = Math.floor(Math.random() * responses.length);
        return responses[randomIndex];
    }
    
    // Fallback if not an array
    if (typeof responses === 'string') {
        return responses;
    }
    
    return "Handled. ✦"; // Ultimate fallback
}

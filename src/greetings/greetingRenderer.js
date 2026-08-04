import fs from 'node:fs';
import path from 'node:path';
import { greetingConfig } from './greetingConfig.js';
import { messageCapability } from './messageCapability.js';
import { welcome1 } from './greetingStyles/welcome1.js';
import { welcome2 } from './greetingStyles/welcome2.js';
import { welcome3 } from './greetingStyles/welcome3.js';
import { db } from '../database/db.js';

// Simple in-memory caches to prevent rate limiting & disk bottleneck
const profilePicCache = new Map();
const queue = [];
let processingQueue = false;

const STYLES = {
  1: welcome1,
  2: welcome2,
  3: welcome3
};

/**
 * Sequential execution queue to prevent race conditions during rapid joins
 */
const enqueueTask = (task) => {
  queue.push(task);
  triggerQueue();
};

const triggerQueue = async () => {
  if (processingQueue) return;
  processingQueue = true;
  while (queue.length > 0) {
    const task = queue.shift();
    try {
      await task();
    } catch (err) {
      console.error('[GREETING RENDERER] Task execution error:', err);
    }
  }
  processingQueue = false;
};

export const greetingRenderer = {
  /**
   * Fetches user profile picture with fallback cache
   */
  async getUserProfilePic(sock, userJid) {
    if (profilePicCache.has(userJid)) {
      return profilePicCache.get(userJid);
    }
    try {
      const url = await sock.profilePictureUrl(userJid, 'image');
      if (url) {
        profilePicCache.set(userJid, url);
        return url;
      }
    } catch (err) {
      // Benign error if user has privacy settings blocking PP
    }
    return null;
  },

  /**
   * Checks whether greetings should fire for a given group.
   *
   * Resolution order:
   *   1. Per-group DB flag (db.getGroup(jid).welcome / .goodbye)
   *      — set via `.welcome on/off` run inside that group
   *   2. Global greetingConfig flag (greeting.json)
   *      — set via `.welcome on/off` run in DM (no group context)
   *
   * If the per-group flag is explicitly true or false, it wins.
   * If the per-group flag was never set (undefined), we fall back to
   * the global default.
   */
  _isGreetingEnabled(jid, isWelcome) {
    const groupData = db.getGroup(jid);

    if (isWelcome) {
      // Per-group flag takes priority if explicitly set
      if (typeof groupData.welcome === 'boolean') {
        return groupData.welcome;
      }
      // Fall back to global
      return greetingConfig.getEnabled();
    } else {
      // Goodbye
      if (typeof groupData.goodbye === 'boolean') {
        return groupData.goodbye;
      }
      // Fall back to global
      return greetingConfig.getGoodbyeEnabled();
    }
  },

  /**
   * Renders the chosen greeting and delivers it securely
   */
  async renderAndSend({ sock, jid, userJid, isWelcome }) {
    enqueueTask(async () => {
      try {
        // 1. Check if greeting is enabled for this group
        //    Per-group flag (DB) → global config fallback
        if (!this._isGreetingEnabled(jid, isWelcome)) {
          console.log(`[GREETING RENDERER] ${isWelcome ? 'Welcome' : 'Goodbye'} disabled for ${jid} (per-group or global)`);
          return;
        }

        // 2. Fetch Group metadata
        let metadata;
        try {
          metadata = await sock.groupMetadata(jid);
        } catch (e) {
          console.error('[GREETING RENDERER] Failed to load group metadata:', e);
          return;
        }

        const groupName = metadata.subject || 'this Group';
        const memberCount = metadata.participants ? metadata.participants.length : 1;
        const userNumber = userJid.split('@')[0];
        const userMention = `@${userNumber}`;

        // 3. Fetch user profile pic
        const profilePicUrl = await this.getUserProfilePic(sock, userJid);

        const variables = {
          userNumber,
          userMention,
          groupName,
          memberCount,
          profilePicUrl
        };

        // 4. Select style based on active style ID
        const activeStyleId = greetingConfig.getStyle();
        const style = STYLES[activeStyleId] || welcome1;

        let payload = null;
        try {
          payload = await style.render({ sock, jid, userJid, variables, isWelcome });
        } catch (err) {
          console.error(`[GREETING RENDERER] Error rendering style ${activeStyleId}:`, err);
          // Fallback to Style 1 (Image Greeting)
          payload = await welcome1.render({ sock, jid, userJid, variables, isWelcome });
        }

        // 5. Message Capability Safeguards & Fallbacks
        const messageType = Object.keys(payload).find(key => ['image', 'document', 'text'].includes(key));
        const capability = messageCapability[`${messageType}Message`] || {};

        // If the selected message type is unsupported, fall back to simple text layout
        if (messageType && !capability) {
          console.log(`[GREETING RENDERER] Fallback triggered. Unsupported message type: ${messageType}`);
          payload = {
            text: payload.caption || payload.text,
            mentions: [userJid]
          };
        }

        // 6. Deliver the primary card
        await sock.sendMessage(jid, payload);

        // 7. Separate audio follow-up if custom welcome audio exists on disk
        const audioSubdir = isWelcome ? 'welcome' : 'goodbye';
        const audioDir = path.join(process.cwd(), 'media', 'greetings', audioSubdir);
        
        if (fs.existsSync(audioDir)) {
          const files = fs.readdirSync(audioDir);
          const audioFile = files.find(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.ogg') || f.endsWith('.wav'));
          
          if (audioFile) {
            const absoluteAudioPath = path.join(audioDir, audioFile);
            console.log(`[GREETING RENDERER] Broadcasting secondary audio file: ${absoluteAudioPath}`);
            
            // Deliver separate audio attachment
            await sock.sendMessage(jid, {
              audio: { url: absoluteAudioPath },
              mimetype: 'audio/mp4',
              ptt: true // Push to Talk audio message format
            });
          }
        }

      } catch (err) {
        console.error('[GREETING RENDERER] Failed to render greeting layout:', err);
      }
    });
  }
};

export default greetingRenderer;

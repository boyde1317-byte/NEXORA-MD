import path from 'node:path';
import fs from 'node:fs';
import { mediaConfig } from './mediaConfig.js';
import { mediaBuilder, detectMimetype, getMediaType } from './mediaBuilder.js';

/**
 * Queue system to handle outbound media messages sequentially and asynchronously
 * to prevent race conditions or connection saturation.
 */
class MediaQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      try {
        await task();
      } catch (err) {
        console.error('[MEDIA QUEUE] Error processing task:', err);
      }
    }

    this.processing = false;
  }
}

const mediaQueue = new MediaQueue();

export const mediaManager = {
  /**
   * Helper to execute a media operation inside a safety container
   */
  async runSafe(operation, fallbackMsg = 'Media operation failed') {
    try {
      return await mediaQueue.add(operation);
    } catch (err) {
      console.error(`[MEDIA MANAGER] ${fallbackMsg}:`, err.message || err);
      return null;
    }
  },

  /**
   * Automatically sends the configured menu audio beneath the menu if enabled.
   */
  async sendMenuAudio(sock, jid, quotedMessage = null) {
    const isAudioEnabled = mediaConfig.get('menuAudio');
    if (!isAudioEnabled) {
      console.log('[MEDIA MANAGER] Menu audio is globally disabled.');
      return null;
    }

    const menuData = mediaConfig.getMenuConfig();
    const audioPath = menuData.audio || './media/audio/menu.mp3';

    // Validate the file exists and is correct size
    const validation = mediaBuilder.validateFile(audioPath);
    if (!validation.valid) {
      console.warn(`[MEDIA MANAGER] Skipped menu audio: ${validation.error}`);
      return null;
    }

    return this.runSafe(async () => {
      const autoVoiceNote = mediaConfig.get('autoVoiceNote');
      const payload = mediaBuilder.buildAudioPayload(audioPath, {
        ptt: autoVoiceNote,
        duration: 5 // Placeholder duration metadata
      });

      console.log(`[MEDIA MANAGER] Sending menu audio: ${audioPath} (ptt: ${autoVoiceNote})`);
      return await sock.sendMessage(jid, payload, { quoted: quotedMessage });
    }, `Failed to send menu audio from ${audioPath}`);
  },

  /**
   * Updates a default media file type by saving a buffer
   */
  async saveRepliedMedia(type, buffer, originalMimetype) {
    let subfolder = 'images';
    let filename = 'menu.jpg';

    if (type === 'audio') {
      subfolder = 'audio';
      filename = originalMimetype.includes('ogg') ? 'menu.opus' : 'menu.mp3';
    } else if (type === 'image') {
      subfolder = 'images';
      filename = originalMimetype.includes('png') ? 'menu.png' : 'menu.jpg';
    } else if (type === 'thumbnail') {
      subfolder = 'thumbnails';
      filename = 'menu.jpg';
    } else if (type === 'video') {
      subfolder = 'videos';
      filename = 'menu.mp4';
    } else if (type === 'document') {
      subfolder = 'documents';
      filename = 'menu.pdf';
    }

    const relativePath = `./media/${subfolder}/${filename}`;
    const absolutePath = path.join(process.cwd(), 'media', subfolder, filename);

    // Ensure the folder exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to disk
    fs.writeFileSync(absolutePath, buffer);
    console.log(`[MEDIA MANAGER] Successfully saved replenished media: ${relativePath}`);

    // Update settings
    if (type === 'audio') {
      mediaConfig.setMenuConfig({ audio: relativePath });
    } else if (type === 'image') {
      mediaConfig.setMenuConfig({ image: relativePath });
    } else if (type === 'thumbnail') {
      mediaConfig.setMenuConfig({ thumbnail: relativePath });
    }

    return relativePath;
  }
};

export default mediaManager;

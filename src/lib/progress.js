/**
 * progress.js — Elapsed-time progress feedback for long-running commands.
 *
 * Sends an initial "working" message, then edits it every few seconds with
 * the elapsed time so users know the bot hasn't frozen. Falls back to
 * sending a fresh message if the client rejects edits.
 *
 * Usage:
 *   const progress = new DownloadProgress(sock, jid, m);
 *   await progress.start('Downloading audio...');
 *   // ... do work ...
 *   await progress.done('✅ Download complete!');
 *   // or: await progress.fail('❌ Download failed: reason');
 */

export class DownloadProgress {
  /**
   * @param {object} sock  Baileys socket
   * @param {string} jid   Target chat JID
   * @param {object} quoted  Message to quote (m)
   * @param {object} [opts]
   * @param {number} [opts.intervalMs=4000]  How often to update the message
   */
  constructor(sock, jid, quoted, opts = {}) {
    this.sock = sock;
    this.jid = jid;
    this.quoted = quoted;
    this.intervalMs = opts.intervalMs ?? 4000;
    this._sent = null;
    this._timer = null;
    this._startTime = 0;
    this._label = 'Processing';
  }

  _formatElapsed() {
    const sec = Math.floor((Date.now() - this._startTime) / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  async _edit(text) {
    if (!this._sent?.key) {
      await this.sock.sendMessage(this.jid, { text }, { quoted: this.quoted });
      return;
    }
    try {
      await this.sock.sendMessage(this.jid, { text, edit: this._sent.key });
    } catch (_) {
      // Client rejected edit — send fresh message as fallback
      try {
        this._sent = await this.sock.sendMessage(this.jid, { text }, { quoted: this.quoted });
      } catch (_) {}
    }
  }

  /**
   * Start the progress indicator with an initial label.
   * @param {string} label  What's being done, e.g. "Downloading audio"
   */
  async start(label = 'Processing') {
    this._label = label;
    this._startTime = Date.now();
    this._sent = await this.sock.sendMessage(this.jid, {
      text: `⏳ ${label}...`,
    }, { quoted: this.quoted });

    this._timer = setInterval(async () => {
      await this._edit(`⏳ ${this._label}... (${this._formatElapsed()} elapsed)`);
    }, this.intervalMs);
  }

  /**
   * Stop the progress and send a final success message.
   * @param {string} message  Final message (defaults to a generic success)
   */
  async done(message) {
    this._stop();
    if (message) {
      await this._edit(message);
    }
  }

  /**
   * Stop the progress and send a final failure message.
   * @param {string} message  Error message
   */
  async fail(message) {
    this._stop();
    await this._edit(message || '❌ Operation failed.');
  }

  _stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

export default DownloadProgress;

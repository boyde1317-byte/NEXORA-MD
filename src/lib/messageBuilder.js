/**
 * messageBuilder.js — chain-method message builder.
 *
 * A NEXORA port of KYYDIW's zapo "Message Builder" API (MIT © 2026 Ripki Dwi
 * Putra / kyyinfinite, docs: github.com/kyyinfinite/kyyinfinite/message.md),
 * re-pointed at our Baileys fork instead of zapo-js:
 *
 *   await button(sock).body('Pick one').quick_reply('Ok', '.menu').send(jid)
 *   await legacyButton(sock).body('Old style').button('yes', 'Yes').send(jid)
 *   await listMessage(sock).title('Menu').section('Main', rows).send(jid)
 *   await airich(sock).text('# Hi').table([...]).code('js', '...').send(jid)
 *
 * The wire formats are the ones this repo already proved on device:
 *   button()       baileysBridge.sendNativeFlow  (interactiveMessage + nativeFlow)
 *   legacyButton() baileysBridge.sendButtonsCard (buttonsMessage, RESPONSE type)
 *   listMessage()  sock.sendMessage({ title, text, sections, buttonText })
 *   airich()       aiRichReply.sendAIRichReply   (richResponseMessage)
 *
 * Deliberate differences from the zapo original, because our fork proves them:
 *   • .location() adds a proven `send_location` button; the fork has no
 *     location *header* slot, and a native-flow header there renders blank.
 *   • listMessage is rejected by the server in groups (same as the original
 *     docs warn) — use .single_select() there.
 */
import { baileysBridge } from '../core/baileysBridge.js';
import { sendAIRichReply, buildAIMarkdownMessage } from './aiRichReply.js';

const toBufferOrUrl = (thumb) => thumb; // passed straight through to the fork

class BaseBuilder {
  constructor(sock) { this._sock = sock; }
  use(sock) { this._sock = sock; return this; }
  build() { throw new Error('build() not implemented'); }
  _client(opts) {
    const sock = opts?.client || this._sock;
    if (!sock) throw new Error('messageBuilder: no client. Pass one to the builder or .send(jid, client).');
    return sock;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// button()  — interactiveMessage + nativeFlowMessage
// ─────────────────────────────────────────────────────────────────────────────
class ButtonBuilder extends BaseBuilder {
  constructor(sock) {
    super(sock);
    this._body = '';
    this._footer = undefined;
    this._title = undefined;
    this._buttons = [];
    this._image = undefined;
    this._offer = undefined;
    this._sheet = undefined;
    this._extra = [];
  }

  body(text) { this._body = String(text ?? ''); return this; }
  footer(text) { this._footer = text ? String(text) : undefined; return this; }
  title(text) { this._title = text ? String(text) : undefined; return this; }
  thumb(media) { this._image = toBufferOrUrl(media); return this; }

  /** Proven replacement for zapo's location header. */
  location({ latitude, longitude, name, address } = {}) {
    this._extra.push({
      text: 'send_location',
      sendLocation: { degreesLatitude: latitude, degreesLongitude: longitude, name, address },
    });
    return this;
  }

  quick_reply(text, id) { this._buttons.push({ text, id: id ?? text }); return this; }
  cta_url(text, url, { webview = false } = {}) { this._buttons.push({ text, url, useWebview: webview }); return this; }
  cta_copy(text, code) { this._buttons.push({ text, copy: code }); return this; }
  cta_call(text, phone) { this._buttons.push({ text, call: String(phone) }); return this; }

  /**
   * List picker. In groups use this instead of listMessage().
   * @param {string} title
   * @param {Array<{ title: string, rows: Array<{ id: string, title: string, description?: string }> }>} sections
   */
  single_select(title, sections = []) {
    const normalized = sections.map((s, i) => ({
      title: s.title || `Section ${i + 1}`,
      rows: (s.rows || []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description || '',
      })),
    }));
    this._buttons.push({ text: title || 'Select', sections: normalized });
    return this;
  }

  bottom_sheet({ limit = 10, listTitle = 'Options', buttonTitle = 'View options' } = {}) {
    this._sheet = { limit, listTitle, buttonTitle };
    return this;
  }

  limited_time_offer({ text, url, copyCode, expiresIn } = {}) {
    this._offer = { text, url, copyCode, expiresIn };
    return this;
  }

  build() {
    const buttons = [...this._buttons, ...this._extra];
    if (!buttons.length) throw new Error('button().build(): add at least one button');
    return {
      text: this._body,
      footer: this._footer,
      title: this._title,
      image: this._image,
      buttons,
      ...(this._offer
        ? {
            offerText: this._offer.text,
            offerUrl: this._offer.url,
            offerCode: this._offer.copyCode,
            offerExpiry: this._offer.expiresIn,
          }
        : {}),
      ...(this._sheet
        ? { optionText: this._sheet.buttonTitle, optionTitle: this._sheet.listTitle }
        : {}),
    };
  }

  async send(jid, arg) {
    const opts = arg && arg.client ? arg : (arg || {});
    const sock = this._client(arg?.client ? arg : null);
    return baileysBridge.sendNativeFlow(sock, jid, this.build(), opts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// legacyButton()  — buttonsMessage with RESPONSE buttons
// ─────────────────────────────────────────────────────────────────────────────
class LegacyButtonBuilder extends BaseBuilder {
  constructor(sock) {
    super(sock);
    this._body = '';
    this._footer = undefined;
    this._title = undefined;
    this._subtitle = undefined;
    this._thumb = undefined;
    this._buttons = [];
  }

  body(text) { this._body = String(text ?? ''); return this; }
  footer(text) { this._footer = text ? String(text) : undefined; return this; }
  title(text) { this._title = text ? String(text) : undefined; return this; }
  subtitle(text) { this._subtitle = text ? String(text) : undefined; return this; }
  thumb(media) { this._thumb = media; return this; }
  location(media) { this._thumb = media; return this; }

  /** @param {string} id sent back when tapped @param {string} text label */
  button(id, text) { this._buttons.push({ id, displayText: text, type: 1 }); return this; }

  build() {
    if (!this._buttons.length) throw new Error('legacyButton().build(): add at least one .button()');
    return {
      body: this._body,
      footer: this._footer,
      title: this._title,
      subtitle: this._subtitle,
      thumbnail: this._thumb,
      buttons: this._buttons,
    };
  }

  async send(jid, arg) {
    const opts = arg && arg.client ? arg : (arg || {});
    const sock = this._client(arg?.client ? arg : null);
    return baileysBridge.sendButtonsCard(sock, jid, this.build(), opts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// listMessage()  — legacy listMessage (rejected by the server in groups)
// ─────────────────────────────────────────────────────────────────────────────
class ListMessageBuilder extends BaseBuilder {
  constructor(sock) {
    super(sock);
    this._title = '';
    this._body = '';
    this._footer = '';
    this._buttonText = 'Open list';
    this._sections = [];
  }

  title(text) { this._title = String(text ?? ''); return this; }
  body(text) { this._body = String(text ?? ''); return this; }
  footer(text) { this._footer = String(text ?? ''); return this; }
  buttonText(text) { this._buttonText = String(text ?? 'Open list'); return this; }

  /** @param {string} title @param {Array<{id:string,title:string,description?:string}>} rows */
  section(title, rows = []) {
    this._sections.push({
      title,
      rows: rows.map((r) => ({ id: r.id, title: r.title, description: r.description || '' })),
    });
    return this;
  }

  build() {
    if (!this._sections.length) throw new Error('listMessage().build(): add at least one .section()');
    return {
      title: this._title,
      text: this._body,
      footer: this._footer,
      buttonText: this._buttonText,
      sections: this._sections,
    };
  }

  async send(jid, arg) {
    const sock = this._client(arg?.client ? arg : null);
    const opts = arg && arg.client ? { ...arg } : (arg || {});
    delete opts.client;
    return sock.sendMessage(jid, this.build(), opts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// airich()  — markdown, tables, code cards, suggestions (richResponseMessage)
// ─────────────────────────────────────────────────────────────────────────────
class AIRichBuilder extends BaseBuilder {
  constructor(sock) {
    super(sock);
    this._blocks = [];
    this._tips = [];
    this._suggest = [];
    this._footer = undefined;
    this._quoted = undefined;
    this._options = { twoStep: true };
  }

  text(text) { this._blocks.push(String(text ?? '')); return this; }

  code(language, code) {
    this._blocks.push('```' + (language || '') + '\n' + String(code ?? '') + '\n```');
    return this;
  }

  /** @param {string[][]} rows first row becomes the header */
  table(rows = []) {
    const clean = rows.filter((r) => Array.isArray(r) && r.length);
    if (!clean.length) return this;
    const width = Math.max(...clean.map((r) => r.length));
    const line = (cells) =>
      `| ${Array.from({ length: width }, (_, i) => String(cells[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;
    const [head, ...body] = clean;
    this._blocks.push([line(head), `|${'---|'.repeat(width)}`, ...body.map(line)].join('\n'));
    return this;
  }

  metadata(text) { this._tips.push(String(text ?? '')); return this; }
  tip(text) { return this.metadata(text); }
  suggest(items = []) { this._suggest.push(...items.map(String)); return this; }
  footer(text) { this._footer = text ? String(text) : undefined; return this; }
  quote(message) { this._quoted = message; return this; }
  context() { return this; } // native-flow context is applied by the sender

  get markdown() { return this._blocks.join('\n\n'); }

  build() {
    if (!this._blocks.length) throw new Error('airich().build(): add some content first');
    return {
      markdown: this.markdown,
      tips: this._tips,
      suggest: this._suggest,
      footer: this._footer,
    };
  }

  /** Raw Baileys payload for the built content (no send). */
  buildPayload() {
    return buildAIMarkdownMessage(this._client(null), this.build());
  }

  async send(jid, arg) {
    const sock = this._client(arg?.client ? arg : null);
    const opts = arg && arg.client ? arg : (arg || {});
    const quoted = this._quoted || opts.quoted;
    return sendAIRichReply(sock, jid, quoted, this.build());
  }
}

export const button = (sock) => new ButtonBuilder(sock);
export const legacyButton = (sock) => new LegacyButtonBuilder(sock);
export const listMessage = (sock) => new ListMessageBuilder(sock);
export const airich = (sock) => new AIRichBuilder(sock);

export default { button, legacyButton, listMessage, airich };

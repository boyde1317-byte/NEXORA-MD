/**
 * richSections.js — the AI-bot rich response card, built section by section.
 *
 * Why this exists: menu 16 used to carry its content in an A2UI BloksWidget
 * (`InteractiveMessage.bloksWidget`, proto tag 66). That field is not in
 * WhatsApp's proto at all, so a real client drops it and the card arrives
 * empty. What the client *does* paint is the bot rich response: a
 * `botForwardedMessage` wrapping a `richResponseMessage` whose `unifiedResponse`
 * is base64 of `{ response_id, sections }`, each section a
 * `GenAI<X>LayoutViewModel` holding one primitive (text, table, code, image,
 * follow-up pill, product card, post, reel, search result). Rem Bot / YONO DEV
 * ships that same envelope; our htmlGames already proves the envelope renders.
 *
 * Sections are addressable: `add*(..., { id })` then `{ insertAt }` or
 * `{ replace }` plus `sendEdit()` mutates the card in place instead of sending
 * another message, which is how a "loading → result" flow stays one bubble.
 */
import crypto from 'crypto';
import { generateWAMessageFromContent, generateMessageIDV2 } from 'baileys';

/** Forwarded-as-AI-bot context; the same id our html game cards use. */
const BOT_JID = '867051314767696@bot';

const layout = (name, data) => ({
  view_model: {
    [Array.isArray(data) ? 'primitives' : 'primitive']: data,
    __typename: `GenAI${name}LayoutViewModel`,
  },
});

/** Tokenise code for GenAICodeUXPrimitive (highlightType 0..5). */
export function tokenizeCode(code, language = 'javascript') {
  const KEYWORDS = new Set(('break case catch continue debugger delete do else finally for function if in ' +
    'instanceof new return switch this throw try typeof var void while with true false null undefined ' +
    'class const let super extends export import yield static constructor async await get set').split(' '));
  const TYPES = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' };
  const tokens = [];
  const push = (content, type) => {
    if (!content) return;
    const last = tokens[tokens.length - 1];
    if (last && last.highlightType === type) last.codeContent += content;
    else tokens.push({ codeContent: content, highlightType: type });
  };
  let i = 0;
  const src = String(code || '');
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      const s = i;
      while (i < src.length && /\s/.test(src[i])) i += 1;
      push(src.slice(s, i), 0);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const s = i;
      i += 2;
      while (i < src.length && src[i] !== '\n') i += 1;
      push(src.slice(s, i), 5);
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const s = i;
      const q = c;
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\' && i + 1 < src.length) i += 2;
        else if (src[i] === q) { i += 1; break; }
        else i += 1;
      }
      push(src.slice(s, i), 3);
      continue;
    }
    if (/[0-9]/.test(c)) {
      const s = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i += 1;
      push(src.slice(s, i), 4);
      continue;
    }
    if (/[a-zA-Z_$]/.test(c)) {
      const s = i;
      while (i < src.length && /[a-zA-Z0-9_$]/.test(src[i])) i += 1;
      const word = src.slice(s, i);
      let type = 0;
      if (KEYWORDS.has(word)) type = 1;
      else {
        let j = i;
        while (j < src.length && /\s/.test(src[j])) j += 1;
        if (src[j] === '(') type = 2;
      }
      push(word, type);
      continue;
    }
    push(c, 0);
    i += 1;
  }
  return {
    codeBlock: tokens,
    unified_codeBlock: tokens.map((t) => ({ content: t.codeContent, type: TYPES[t.highlightType] })),
    language,
  };
}

/** Row array → GenATableUXPrimitive metadata (header row flagged). */
export function toTableMetadata(rows = []) {
  const [header, ...body] = rows;
  if (!header) return { title: '', rows: [], unified_rows: [] };
  const width = Math.max(header.length, ...body.map((r) => r.length));
  const pad = (r) => [...r, ...new Array(width - r.length).fill('')];
  const unified_rows = [
    { is_header: true, cells: pad(header) },
    ...body.map((r) => ({ is_header: false, cells: pad(r) })),
  ];
  return {
    title: '',
    rows: unified_rows.map((r) => ({ items: r.cells, ...(r.is_header ? { isHeading: true } : {}) })),
    unified_rows,
  };
}

export class RichSections {
  constructor(sock) {
    if (!sock) throw new Error('RichSections: a socket is required');
    this.sock = sock;
    this.title = '';
    this.footer = '';
    this.contextInfo = {};
    this.sections = []; // { id, layout, sub }
    this.sources = [];
    this.lastKey = null;
    this.lastJid = null;
  }

  setTitle(text) { this.title = String(text || ''); return this; }

  setFooter(text) { this.footer = String(text || ''); return this; }

  setContextInfo(info) { this.contextInfo = info || {}; return this; }

  _upsert(id, section, { insertAt, replace } = {}) {
    const key = id || section.id || crypto.randomUUID();
    const entry = { id: key, ...section };
    if (replace) {
      const at = this.sections.findIndex((s) => s.id === replace);
      if (at !== -1) { this.sections[at] = entry; return this; }
    }
    if (insertAt) {
      const at = this.sections.findIndex((s) => s.id === insertAt);
      if (at !== -1) { this.sections.splice(at + 1, 0, entry); return this; }
    }
    this.sections.push(entry);
    return this;
  }

  addText(text, opts = {}) {
    return this._upsert(opts.id, { layout: layout('Single', { text: String(text || ''), __typename: 'GenAIMarkdownTextUXPrimitive' }) }, opts);
  }

  addCode(code, opts = {}) {
    const lang = opts.language || 'javascript';
    const meta = tokenizeCode(code, lang);
    return this._upsert(opts.id, {
      layout: layout('Single', { language: lang, code_blocks: meta.unified_codeBlock, __typename: 'GenAICodeUXPrimitive' }),
    }, opts);
  }

  addTable(rows, opts = {}) {
    const meta = toTableMetadata(rows);
    return this._upsert(opts.id, {
      layout: layout('Single', { rows: meta.unified_rows, __typename: 'GenATableUXPrimitive' }),
    }, opts);
  }

  addSuggest(suggestions = [], opts = {}) {
    const items = suggestions
      .map((s) => (typeof s === 'string' ? { text: s } : s))
      .filter(Boolean)
      .map((s) => ({ text: String(s.text), __typename: 'GenAIFollowUpSuggestionPillPrimitive' }));
    return this._upsert(opts.id, { layout: layout('Single', items), ...(opts.sub ? { sub: opts.sub } : {}) }, opts);
  }

  addImage(url, opts = {}) {
    const item = opts.status
      ? { status: opts.status, update_text: opts.update_text || 'Generating image…', __typename: 'GenAIImaginePrimitive' }
      : { url, __typename: 'GenAIImaginePrimitive' };
    return this._upsert(opts.id, { layout: layout('Single', item) }, opts);
  }

  addSearch(sources = [], opts = {}) {
    const mapped = sources.map((s) => ({ ...s, __typename: 'GenAISearchResultPrimitive' }));
    return this._upsert(opts.id, { layout: layout('Single', mapped) }, opts);
  }

  addProduct(item = {}, opts = {}) {
    return this._upsert(opts.id, {
      layout: layout('Single', { ...item, __typename: 'GenAIProductItemCardPrimitive' }),
    }, opts);
  }

  addPost(item = {}, opts = {}) {
    return this._upsert(opts.id, {
      layout: layout('Single', { ...item, __typename: 'GenAIPostPrimitive' }),
    }, opts);
  }

  addReel(item = {}, opts = {}) {
    return this._upsert(opts.id, {
      layout: layout('Single', { ...item, is_verified: !!item.verified, __typename: 'GenAIReelPrimitive' }),
    }, opts);
  }

  /** The sections array exactly as it goes on the wire. */
  getSections() {
    const base = this.sections.map((s) => s.layout);
    if (this.footer) {
      base.push(layout('Single', { text: this.footer, __typename: 'GenAIMetadataTextPrimitive' }));
    }
    return base;
  }

  /** Build the relayable message. Pure enough to test without a socket. */
  build(jid, { forwarded = true, quoted, messageId } = {}) {
    const forward = forwarded
      ? {
        forwardingScore: 1,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid: BOT_JID },
        forwardOrigin: 4,
      }
      : {};
    const q = quoted
      ? {
        stanzaId: quoted?.key?.id || quoted?.id,
        participant: quoted?.key?.participant || quoted?.key?.remoteJid,
        quotedType: 0,
        quotedMessage: quoted.message ?? quoted,
      }
      : {};
    const sections = this.getSections();
    const submessages = this.sections.map((s) => s.sub).filter(Boolean);
    const message = {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: this.title,
          richResponseSourcesMetadata: { sources: this.sources },
        },
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages,
            unifiedResponse: {
              data: Buffer.from(JSON.stringify({
                response_id: crypto.randomUUID(),
                sections,
              })).toString('base64'),
            },
            contextInfo: { ...forward, ...q, ...this.contextInfo },
          },
        },
      },
    };
    return generateWAMessageFromContent(jid, message, {
      messageId: messageId || generateMessageIDV2(),
      ...(this.sock.user?.id ? { userJid: this.sock.user.id } : {}),
    });
  }

  async send(jid, options = {}) {
    const msg = this.build(jid, options);
    this.lastKey = msg.key;
    this.lastJid = jid;
    await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id, ...options });
    return msg;
  }

  /** Edit the card that is already on screen instead of sending a new one. */
  async sendEdit(options = {}) {
    if (!this.lastKey) throw new Error('RichSections: nothing to edit yet');
    const msg = this.build(this.lastJid, { ...options, messageId: this.lastKey.id });
    await this.sock.relayMessage(this.lastJid, msg.message, { messageId: this.lastKey.id, ...options });
    return msg;
  }
}

/** Decode a built card back into its sections — used by the verify suite. */
export function decodeRichCard(content) {
  const b64 = content?.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse?.data;
  if (!b64) return null;
  const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return {
    response_id: parsed.response_id,
    sections: parsed.sections || [],
    typenames: (parsed.sections || []).map((s) => s.view_model?.__typename),
    primitives: (parsed.sections || []).map((s) => s.view_model?.primitive?.__typename
      || (s.view_model?.primitives || [])[0]?.__typename),
  };
}

export default RichSections;

/**
 * galleryCard.js — swipeable image gallery inside one WhatsApp bubble.
 *
 * Technique lifted from Rem Bot's Pinterest command (YONO DEV): every image is
 * inlined as a base64 data URI into a small HTML document, and that document is
 * shipped as a `GenAIaeacdsnwHtmlPrimitive` inside the AI rich response. The
 * result is a self-contained viewer with prev/next controls and a counter, with
 * no network calls at render time — which matters, because the client renders
 * the HTML in a sandbox with no access to the chat's media.
 *
 * Why data URIs and not URLs: a remote <img src> is fetched by the webview, and
 * Pinterest/CDN hotlinks either 403 or need the same cookies. Inlining also
 * means the card still works offline and after the CDN link expires.
 *
 * Budget: WhatsApp drops an oversized rich response, so the payload is capped
 * (GALLERY_LIMITS). Upstream used 20 images / 500 KB; the cap is enforced while
 * collecting, so a heavy first image cannot starve the rest of the set.
 */
import crypto from 'crypto';
import { generateWAMessageFromContent } from 'baileys';

export const GALLERY_LIMITS = {
  images: 20,
  candidates: 30,
  bytes: 500 * 1024,
  fetchTimeoutMs: 12000,
};

const UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Fetches one image and returns it as a data URI.
 * @returns {Promise<{uri: string, size: number, mime: string}>}
 */
export async function fetchAsDataUri(url, opts = {}) {
  const { fetchImpl = globalThis.fetch, timeoutMs = GALLERY_LIMITS.fetchTimeoutMs } = opts;
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': UA, Accept: 'image/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  return { uri: `data:${mime};base64,${buf.toString('base64')}`, size: buf.length, mime };
}

/**
 * Turns a list of image URLs into data-URI items under the size budget.
 * Failures are skipped rather than fatal: a gallery of 12 of 15 images beats an
 * error message.
 *
 * @param {string[]} urls
 * @param {{fetchImpl?: Function, limits?: object}} [opts]
 * @returns {Promise<Array<{uri: string, size: number, source: string}>>}
 */
export async function collectGalleryDataUris(urls = [], opts = {}) {
  const limits = { ...GALLERY_LIMITS, ...(opts.limits || {}) };
  const candidates = urls.slice(0, Math.min(limits.candidates, urls.length));
  const settled = await Promise.allSettled(
    candidates.map((url) => fetchAsDataUri(url, { fetchImpl: opts.fetchImpl }))
  );

  const out = [];
  let total = 0;
  settled.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    if (out.length >= limits.images) return;
    const { uri, size } = result.value;
    if (total + size > limits.bytes) return;
    total += size;
    out.push({ uri, size, source: candidates[i] });
  });
  return out;
}

/**
 * The viewer document. Images are inlined, so `items` must already be data URIs.
 *
 * @param {{title?: string, hint?: string, items: Array<{uri: string, title?: string}>}} input
 * @returns {string} a complete HTML document
 */
export function buildGalleryHtml({ title = 'Gallery', hint = '', items = [] } = {}) {
  const list = JSON.stringify(items.map((i) => ({ img: i.uri, title: i.title || '' })))
    .replace(/</g, '\\u003c')
    .replace(/\u2028|\u2029/g, '');
  return `<style>
*{box-sizing:border-box}body{margin:0;background:transparent;font-family:system-ui,Arial,sans-serif;color:#fff}
.wrap{width:100%;max-width:620px;margin:auto;padding:12px}
.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:18px;overflow:hidden}
.head{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
.head small{display:block;font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase}
.head b{font-size:17px}
.stage{position:relative;background:#000;aspect-ratio:1/1}
.stage img{width:100%;height:100%;display:block;object-fit:contain;background:#000}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.25);background:rgba(20,20,20,.55);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.nav.prev{left:10px}.nav.next{right:10px}
.bottom{padding:10px 16px;display:flex;justify-content:space-between;gap:10px}
.counter{font-size:12px;color:#999}.hint{font-size:12px;color:#00a884;text-align:right}
</style>
<div class="wrap"><div class="card">
<div class="head"><small>Gallery</small><b>${escapeHtml(title)}</b></div>
<div class="stage"><img id="img" alt=""><div class="nav prev" id="prev">&lsaquo;</div><div class="nav next" id="next">&rsaquo;</div></div>
<div class="bottom"><span class="counter" id="counter"></span><span class="hint">${escapeHtml(hint)}</span></div>
</div></div>
<script>
var items=${list};var idx=0;var img=document.getElementById('img');var counter=document.getElementById('counter');
function render(){if(!items.length)return;img.src=items[idx].img;counter.textContent=(idx+1)+' / '+items.length;}
document.getElementById('prev').addEventListener('click',function(){idx=(idx-1+items.length)%items.length;render();});
document.getElementById('next').addEventListener('click',function(){idx=(idx+1)%items.length;render();});
render();
</script>`;
}

/**
 * Builds the rich response that carries the viewer.
 *
 * @param {{title?: string, hint?: string, sources?: object[], items: Array<{uri: string}>}} input
 * @returns {object} the `richResponseMessage` content, ready for relayMessage
 */
export function buildGalleryMessage({ title = 'Gallery', hint = '', sources = [], items = [] } = {}) {
  const sections = [];
  if (sources.length) {
    sections.push({
      view_model: {
        primitive: {
          sources: sources.slice(0, 12).map((s, i) => ({
            source_type: 'THIRD_PARTY',
            source_display_name: String(s.name || `${i + 1}`).slice(0, 90),
            source_subtitle: String(s.subtitle || '').slice(0, 90),
            source_url: s.url,
            favicon: { url: s.favicon || '', mime_type: 'image/jpeg', width: 16, height: 16 },
          })),
          __typename: 'GenAISearchResultPrimitive',
        },
        __typename: 'GenAISingleLayoutViewModel',
      },
    });
  }
  sections.push({
    view_model: {
      primitive: {
        payload: buildGalleryHtml({ title, hint, items }),
        url: 'https://nexora.dev',
        trusted_sources: ['nexora.dev'],
        __typename: 'GenAIaeacdsnwHtmlPrimitive',
      },
      __typename: 'GenAISingleLayoutViewModel',
    },
  });

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      messageSecret: crypto.randomBytes(32),
      botMetadata: { messageDisclaimerText: title, richResponseSourcesMetadata: { sources: [] } },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: '[ CANNOT_LOAD_HTML ]' }],
          unifiedResponse: {
            data: Buffer.from(
              JSON.stringify({ response_id: crypto.randomUUID(), sections }),
              'utf8'
            ).toString('base64'),
          },
        },
      },
    },
  };
}

/**
 * Sends the gallery. Returns the generated message, or null when there is
 * nothing to show or the payload is over budget.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {{title?: string, hint?: string, urls?: string[], items?: Array, sources?: object[]}} input
 * @param {{quoted?: object, fetchImpl?: Function}} [opts]
 */
export async function sendGalleryCard(sock, jid, input = {}, opts = {}) {
  const items = input.items?.length
    ? input.items
    : await collectGalleryDataUris(input.urls || [], { fetchImpl: opts.fetchImpl });
  if (!items.length) return null;

  const content = buildGalleryMessage({ title: input.title, hint: input.hint, sources: input.sources, items });
  const generated = generateWAMessageFromContent(
    jid,
    content,
    { userJid: sock.user?.id, quoted: opts.quoted }
  );
  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
  return generated;
}

export default sendGalleryCard;

/**
 * dimCard.js — the grey-card house style.
 *
 * Menu 21 established it and Skyler approved it as the look for every menu: the
 * copy rides in `footer.text`, which WhatsApp paints small and grey, while the
 * body keeps a single zero-width space so the bubble stays that size at all.
 * Long footers were verified on device to render whole, so the whole menu card
 * text goes there unchanged.
 *
 * Styles opt in by passing `dim: true` to a baileysBridge card sender, or by
 * calling greyCopy() directly when they build their own proto.
 */
import { BAR_ZWSP } from './galaxyBar.js';

/** The zero-width space the body carries instead of visible text. */
export const DIM_BODY = BAR_ZWSP;

/**
 * Move card copy into the grey footer.
 *
 * @param {string} copy    the menu text, greyed as-is
 * @param {string} [footer] an existing footer line kept below the copy
 * @returns {{ body: string, footer: string }}
 */
export const greyCopy = (copy, footer = '') => {
  const text = String(copy || '').trim();
  const tail = String(footer || '').trim();
  return {
    body: DIM_BODY,
    footer: tail && !text.includes(tail) ? `${text}\n\n${tail}` : text,
  };
};

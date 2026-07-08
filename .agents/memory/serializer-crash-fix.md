---
name: Serializer quoted-message crash
description: contextInfo.participant undefined guard — crashes all reply-message commands without this fix
---

## Rule
Always guard `contextInfo.participant` before calling string methods on it. In DMs and self-quoted messages it can be `undefined` even when `contextInfo.quotedMessage` exists.

**Why:** Baileys does not guarantee `participant` in 1-to-1 chats or when quoting your own messages. Calling `.includes(':')` on `undefined` throws a TypeError that propagates up through `serialize()` and silently kills command handling for all replied messages.

**How to apply:** Use a `normaliseJid(raw)` helper that accepts `undefined`/null and falls back to the message's own `remoteJid`:
```js
const rawQuotedSender = contextInfo.participant || message.key.remoteJid || '';
const quotedSender    = normaliseJid(rawQuotedSender);
```

// ── INERT FRAMEWORK HOOK (staged from LUNA MD, NexoraFlex format) ──────────
// LUNA MD "before"/"all" hook: in the old framework this ran on every message.
// In NexoraFlex it is INERT: the loader (src/core/client.js) only registers a
// plugin whose default export is an object with a string `name` and an
// `execute` function, and the dispatcher (src/core/message.js) never calls
// plugin `before`/`all` hooks. Staged as-is for future porting; do not expect
// it to run until it is rewritten as a NexoraFlex command plugin.
// Expected loader outcome: SKIPPED — no default export (named `before` export only).
//   Loader warns: [PLUGIN WARN] Skipping on1.js: No default export found
// auto-stub.js - 100% professional working code
export async function before(m, { conn }) {
  try {
    if (m.messageStubType == null) return
    if (!m.key) return

    // Let WhatsApp finish sending the message, then react
    await new Promise(r => setTimeout(r, 500))

    let list = ["❤️", "🔥", "✨", "👋", "🎉", "😍", "🫶"]
    let emoji = list[Math.floor(Math.random() * list.length)]

    await conn.sendMessage(m.chat, {
      react: {
        text: emoji,
        key: m.key
      }
    })

    console.log(`✅ Reacted with ${emoji} to ${m.messageStubType} in ${m.chat}`)

  } catch (e) {
    console.log("❌ Reaction failed:", e.message)
  }
}

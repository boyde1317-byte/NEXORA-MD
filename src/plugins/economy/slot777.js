/**
 * slot777.js — Slot 777 HTML game (LUNA slot.js port).
 *
 *   .slot777   playable slot machine card (client-side reels + sounds)
 *
 * Ported from the LUNA MD slot.js plugin. NexoraFlex already ships
 * .slots (src/plugins/economy/slots.js, aliases slot/reels) — a
 * coin-betting slot — so this HTML variant is .slot777 and never
 * shadows it. Note: the LUNA command regex also matched `slot`; that
 * alias is NOT taken here.
 *
 * Differences from the LUNA MD original (luna-md/plugins/slot.js):
 *   - The HTML scene now uses the house verification envelope from
 *     src/plugins/general/ping3.js: the shared VERIFICATION_SIGNATURE
 *     constant + certificate chain from
 *     src/assets/htmlgames/certificate.json, a fresh
 *     crypto.randomBytes(32) messageSecret and a fresh
 *     crypto.randomUUID() botResponseId per send. The LUNA original
 *     sent a base64 string secret and no proofs at all.
 *   - On relay failure the plugin falls back to plain text instead of
 *     throwing.
 *   - Branding 'LUNA MD' -> 'NEXORA MD' (header, footer, jackpot line,
 *     submessage, disclaimer); response_id 'alya-slot-...' ->
 *     'nexora-slot-777-...'.
 *   - The game itself is unchanged and client-side only: the 1,000 GP
 *     balance lives inside the card, no coins move in the bot db.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). Copied from src/plugins/general/ping3.js.
const VERIFICATION_SIGNATURE =
  'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==';
const CERT_PATH = path.resolve(__dirname, '../../assets/htmlgames/certificate.json');
let certificateChainCache;
function loadCertificateChain() {
  if (certificateChainCache) return certificateChainCache;
  try {
    const raw = fs.readFileSync(CERT_PATH, 'utf-8');
    const chain = JSON.parse(raw);
    certificateChainCache = Array.isArray(chain) ? chain : [];
  } catch (_) {
    certificateChainCache = [];
  }
  return certificateChainCache;
}

const SLOT_HTML = `
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
html,body{margin:0;padding:0;width:100%;background:transparent;font-family:Arial;color:#fff;overflow:hidden}
.wrap{width:100%;max-width:620px;margin:auto;padding:7px}
.card{position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(180deg,#171525 0%,#0b0a12 100%);border:1px solid rgba(255,255,255,.13)}
.header{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}
.brand{display:flex;align-items:center}
.logo{width:43px;height:43px;display:flex;align-items:center;justify-content:center;border-radius:14px;margin-right:10px;font-weight:900;background:linear-gradient(145deg,#8b79ff,#5541c5)}
.title{font-size:18px;font-weight:800}
.balance{text-align:right}
.balance-label{font-size:8px;letter-spacing:1.3px;color:#77748c}
.balance-value{margin-top:4px;font-size:18px;font-weight:800}
.main{padding:15px 12px 13px}
.jackpot{text-align:center;margin-bottom:13px}
.jackpot-label{font-size:8px;letter-spacing:2.4px;color:#77748c}
.jackpot-value{font-size:25px;font-weight:900;letter-spacing:3px;text-shadow:0 0 12px rgba(139,121,255,.6)}
.machine{padding:13px 10px 14px;border-radius:21px;background:linear-gradient(180deg,#211e35,#0d0c15);border:1px solid rgba(255,255,255,.14)}
.reels{display:flex;gap:7px;justify-content:center;padding:11px 8px;border-radius:17px;background:#07070b;border:1px solid rgba(255,255,255,.09)}
.reel{width:33%;height:110px;display:flex;align-items:center;justify-content:center;border-radius:15px;background:linear-gradient(180deg,#252438,#11101b);border:2px solid rgba(255,255,255,.12)}
.symbol{font-size:48px}
.reel.spinning .symbol{animation:slotblur .08s linear infinite}
@keyframes slotblur{0%{transform:translateY(-10px);filter:blur(2px)}50%{transform:translateY(10px);filter:blur(3px)}100%{transform:translateY(-10px);filter:blur(2px)}}
.button{width:100%;height:51px;margin-top:12px;border:0;border-radius:15px;font-size:13px;font-weight:900;color:#fff;background:linear-gradient(135deg,#8270ff,#5946cc)}
.result{min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;margin-top:10px;padding:10px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);font-size:10px;color:#77748a}
.result.win{color:#fff;background:rgba(105,87,229,.15)}
.footer{display:flex;justify-content:center;gap:7px;padding:0 0 13px;font-size:8px;color:#5e5b70}
.dot{width:5px;height:5px;border-radius:50%;background:#67e6a5}
</style>
<div class="wrap"><div class="card">
<div class="header"><div class="brand"><div class="logo">777</div><div><div style="font-size:8px;letter-spacing:2px;color:#77748c">NEXORA MD • BY MOONSON</div><div class="title">Slot 777</div></div></div><div class="balance"><div class="balance-label">GAME POINT</div><div id="balance" class="balance-value">1,000</div></div></div>
<div class="main"><div class="jackpot"><div class="jackpot-label">CURRENT JACKPOT</div><div id="jackpot" class="jackpot-value">777,777</div></div>
<div class="machine"><div class="reels"><div id="reel1" class="reel"><div id="symbol1" class="symbol">7️⃣</div></div><div id="reel2" class="reel"><div id="symbol2" class="symbol">💎</div></div><div id="reel3" class="reel"><div id="symbol3" class="symbol">🍒</div></div></div><div style="height:3px;margin:-2px 21px 0;border-radius:10px;background:#8b79ff"></div><button id="spin" class="button">SPIN 777</button><div id="result" class="result">Press SPIN - by moonson</div></div></div><div class="footer"><span class="dot"></span><span>NEXORA MD • MOONSON</span></div></div></div>
<script>
(function(){
var symbols=["7️⃣","💎","🍒","🍋","🍇","⭐","🔔"];
var r1=document.getElementById("reel1"),r2=document.getElementById("reel2"),r3=document.getElementById("reel3");
var s1=document.getElementById("symbol1"),s2=document.getElementById("symbol2"),s3=document.getElementById("symbol3");
var btn=document.getElementById("spin"),res=document.getElementById("result"),bal=document.getElementById("balance"),jack=document.getElementById("jackpot");
var balance=1000,cost=10,jackpot=777777,spinning=false;var audioCtx=null;
function getCtx(){if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}return audioCtx;}
function fmt(n){return String(Math.floor(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,",")}
function upd(){bal.textContent=fmt(balance);jack.textContent=fmt(jackpot)}
function rnd(){return symbols[Math.floor(Math.random()*symbols.length)]}
function tick(){var ctx=getCtx();if(!ctx)return;var o=ctx.createOscillator();var g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=900;o.type="square";g.gain.value=0.15;o.start();g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.08);o.stop(ctx.currentTime+0.08);}
function winSound(){var ctx=getCtx();if(!ctx)return;var o=ctx.createOscillator();var g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=600;g.gain.value=0.3;o.start();o.frequency.exponentialRampToValueAtTime(1200,ctx.currentTime+0.3);g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.6);o.stop(ctx.currentTime+0.6);}
function loseSound(){var ctx=getCtx();if(!ctx)return;var o=ctx.createOscillator();var g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=200;g.gain.value=0.2;o.start();o.stop(ctx.currentTime+0.15);}
function anim(reel,sym,delay){setTimeout(function(){reel.classList.add("spinning");var c=0;var t=setInterval(function(){sym.textContent=rnd();tick();c++;if(c>=16){clearInterval(t);reel.classList.remove("spinning");}},75);},delay);}
function spin(){if(spinning)return;if(balance<cost){res.textContent="Not enough points - by moonson";return}spinning=true;balance-=cost;jackpot+=cost;upd();btn.textContent="SPINNING...";res.textContent="Machine spinning...";anim(r1,s1,0);anim(r2,s2,150);anim(r3,s3,300);setTimeout(finish,1350);}
function finish(){var a=rnd(),b=rnd(),c=rnd();var roll=Math.random();if(roll<0.04){a="7️⃣";b="7️⃣";c="7️⃣"}else if(roll<0.14){var l=rnd();a=l;b=l;c=l}else if(roll<0.35){var p=rnd();a=p;b=p}s1.textContent=a;s2.textContent=b;s3.textContent=c;var reward=0,msg="";if(a==="7️⃣"&&b==="7️⃣"&&c==="7️⃣"){reward=7770;msg="🎰 JACKPOT 777! +7,770 GP - NEXORA";winSound()}else if(a===b&&b===c){reward=1000;msg="🎉 THREE MATCH! +1,000 GP";winSound()}else if(a===b||a===c||b===c){reward=100;msg="✨ DOUBLE! +100 GP";winSound()}else if(a==="💎"||b==="💎"||c==="💎"){reward=50;msg="💎 DIAMOND! +50 GP";winSound()}else{msg="No luck yet - try again! by moonson";loseSound()}balance+=reward;upd();res.className=reward>0?"result win":"result";res.textContent=msg;spinning=false;btn.textContent="SPIN 777";}
btn.addEventListener("click",function(e){e.preventDefault();spin()});upd();
})();
</script>
`.trim();

export default {
  name: 'slot777',
  aliases: [],
  category: 'economy',
  description: 'Slot 777 — playable slot machine card (client-side reels, 1,000 GP to start).',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    const responseId = `nexora-slot-777-${Date.now()}`;
    const certificateChain = loadCertificateChain();
    const payload = {
      response_id: responseId,
      sections: [{
        view_model: {
          primitive: {
            __typename: 'GenAIaeacdsnwHtmlPrimitive',
            payload: SLOT_HTML,
            url: 'https://nexora.dev',
            trusted_sources: ['nexora.dev'],
          },
          __typename: 'GenAISingleLayoutViewModel',
        },
      }],
    };

    try {
      await sock.relayMessage(m.from, {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          messageSecret: crypto.randomBytes(32),
          botMetadata: {
            messageDisclaimerText: '🎰 Slot by moonson • NEXORA MD',
            botResponseId: crypto.randomUUID(),
            ...(certificateChain.length
              ? {
                  verificationMetadata: {
                    proofs: [{
                      version: 1,
                      useCase: 1,
                      signature: VERIFICATION_SIGNATURE,
                      certificateChain,
                    }],
                  },
                }
              : {}),
          },
        },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [{ messageType: 2, messageText: 'NEXORA • SLOT 777 - BY MOONSON' }],
              unifiedResponse: { data: Buffer.from(JSON.stringify(payload)).toString('base64') },
              contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
                forwardOrigin: 4,
              },
            },
          },
        },
      }, {});
    } catch (err) {
      console.warn('[slot777] HTML relay failed, plain fallback:', err.message);
      await m.reply('🎰 *Slot 777*\n\nThe slot machine card failed to send. Try again — the reels are client-side, 1,000 GP to start, 10 GP a spin.');
    }
  },
};

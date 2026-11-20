/**
 * ping3.js — .ping3 / .speed3 — galaxy portal ping.
 *
 * A two-tab in-chat HTML surface (FOAIDNixelButtonSheets): "Live Speed"
 * (portal intro, eight planets with live stats) and "Server Live" (six
 * planets, server monitor). Ported from the LUNA MD plugin of the same
 * shape; the HTML and the two-tab envelope are kept as-is, only the
 * branding moved to NEXORA MD.
 *
 * Why a new command and not a replacement: NexoraFlex already ships
 * src/plugins/general/ping.js (.ping, aliases p/speed) with its own HTML
 * monitor tier via src/lib/htmlGames.js. This one stays separate so the
 * existing ping is untouched.
 *
 * Differences from the LUNA MD original (luna-md/plugins/ping3.js):
 *   - `conn` -> `sock`, `m.chat` -> `m.from` (NexoraFlex serializes the
 *     chat jid as m.from; there is no m.chat).
 *   - User/chat counts come from the execute-context `db` (db.data.users
 *     and db.data.groups). The original read db?.data?.chats — NexoraFlex
 *     has no `chats` table; groups are under db.data.groups.
 *   - The STRIPPED verification signature/certificateChain are gone. In
 *     their place this uses the same scene verification blob NexoraFlex's
 *     own HTML tier ships (src/lib/htmlGames.js): the static signature
 *     constant plus the certificate chain loaded from
 *     src/assets/htmlgames/certificate.json. If that file is missing or
 *     empty the proof block is omitted, exactly like sendHtmlGame does.
 *   - messageSecret was a hardcoded string in the original; it is now
 *     crypto.randomBytes(32) per send, and botResponseId is a fresh
 *     crypto.randomUUID() — both match what htmlGames.js does (the
 *     per-message secret is required for the client to render).
 *   - yono.dev URL / trusted_sources -> nexora.dev, matching the house
 *     HTML tier. response_id rebranded to ping-portal-galaxy-nexora-2026.
 *   - On relay failure the plugin falls back to a plain-text ping instead
 *     of throwing (the dispatcher would auto-reply an error otherwise).
 *
 * Honest note: most numbers on the planets are decorative, not measured —
 * ping starts as a random 30-70 ms and the tick jitters it, CPU/RAM
 * percentages are random, and the user count ticks up at random. Only
 * uptime, heap/RAM totals, user/group counts, host and Node version are
 * real. Same behaviour as the original; kept, not fixed.
 */
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). The LUNA original's proofs were stripped by
// pasting and could not be recovered; this is the house replacement.
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

function buildPingHTML({ _uptime, pingStart, totalRam, freeRam, usedRam, cpuModel, userCount, chatCount }) {
  return `
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{margin:0;background:#000;font-family:Arial,sans-serif;overflow:hidden}
.bg{position:relative;width:100%;max-width:640px;margin:auto;height:730px;background:radial-gradient(ellipse at 50% 0%,#0a0a2e 0%,#050510 45%,#000 100%);overflow:hidden}
canvas#space{position:absolute;inset:0;width:100%;height:100%}
.fog{position:absolute;border-radius:50%;filter:blur(60px);opacity:.28}
.f1{width:320px;height:320px;top:-80px;left:-80px;background:#6d28d9;animation:fog 18s ease-in-out infinite}
.f2{width:300px;height:300px;bottom:-70px;right:-70px;background:#0e7490;animation:fog 21s ease-in-out infinite reverse}
@keyframes fog{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.twinkle{position:absolute;width:3px;height:3px;background:#fff;border-radius:50%;box-shadow:0 0 8px 2px rgba(255,255,255,.9);animation:twinkle 2.5s ease-in-out infinite}
@keyframes twinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1.4)}}
.meteor{position:absolute;width:110px;height:2px;background:linear-gradient(90deg,#fff,transparent);border-radius:999px;transform:rotate(-28deg);opacity:0;box-shadow:0 0 10px #fff;animation:meteor 7s linear infinite}
.meteor2{animation-delay:3.5s;animation-duration:9s}
.meteor3{animation-delay:5.5s;animation-duration:6s}
@keyframes meteor{0%{opacity:0;transform:translate(0,0) rotate(-28deg)}2%{opacity:1}8%{opacity:0;transform:translate(-320px,180px) rotate(-28deg)}100%{opacity:0}}
.asteroid{position:absolute;background:radial-gradient(circle at 35% 30%,#a8a29e,#57534e 55%,#1c1917);border-radius:45% 55% 52% 48% / 55% 48% 52% 45%;box-shadow:inset -4px -4px 8px rgba(0,0,0,.7),0 0 10px rgba(0,0,0,.5);animation:floatRock 14s ease-in-out infinite}
@keyframes floatRock{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(14px,-18px) rotate(28deg)}}

/* ===== PORTAL GATE ===== */
.portal-intro{position:absolute;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 50%,rgba(109,40,217,.35),transparent 60%);animation:portalHide .6s ease forwards 3.1s;pointer-events:none}
@keyframes portalHide{to{opacity:0;visibility:hidden}}
.portal-top-text{color:#fff;font-weight:900;font-size:13px;letter-spacing:3px;text-shadow:0 0 16px #a78bfa;margin-bottom:18px;animation:portalTxt 3s forwards}
.portal-sub-text{color:#ddd6fe;font-weight:700;font-size:10px;letter-spacing:2px;margin-top:18px}
@keyframes portalTxt{0%,70%{opacity:1}100%{opacity:0}}
.portal-gate{position:relative;width:240px;height:240px;display:flex;align-items:center;justify-content:center}
.portal-core{width:155px;height:155px;border-radius:50%;background:radial-gradient(circle,#fff 0%,#ddd6fe 12%,#a78bfa 32%,#6d28d9 58%,#1e1b4b 85%,transparent 100%);box-shadow:0 0 60px 20px rgba(167,139,250,.85),0 0 120px 45px rgba(109,40,217,.55),inset 0 0 40px rgba(255,255,255,.9);animation:corePulse .9s ease-in-out infinite,coreOpen 3s ease forwards}
@keyframes corePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes coreOpen{0%{transform:scale(.05);opacity:0}18%{opacity:1}70%{transform:scale(1.05)}100%{transform:scale(1.7);opacity:0}}
.portal-ring{position:absolute;border-radius:50%}
.r1{inset:0;border:3px dashed rgba(196,181,253,.95);animation:spinRing 4s linear infinite}
.r2{inset:18px;border:2px solid rgba(103,232,249,.8);box-shadow:0 0 20px rgba(103,232,249,.4);animation:spinRing 2.5s linear infinite reverse}
.r3{inset:38px;border:1px solid rgba(255,255,255,.5);animation:spinRing 6s linear infinite}
@keyframes spinRing{to{transform:rotate(360deg)}}
.portal-flash{position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),transparent 60%);opacity:0;animation:flash 3s ease forwards}
@keyframes flash{0%,80%{opacity:0}85%{opacity:1}100%{opacity:0;transform:scale(2.2)}}
.portal-particles{position:absolute;width:6px;height:6px;background:#fff;border-radius:50%;box-shadow:0 0 10px #fff;animation:part 1.2s ease-in-out infinite}
@keyframes part{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}

/* PLANETS ENTER FROM PORTAL */
.planets-enter{opacity:0;animation:showPlanets .9s ease forwards 2.6s}
@keyframes showPlanets{from{opacity:0;transform:scale(.88) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
.top{opacity:0;animation:showPlanets .8s ease forwards 2.4s}
.bottom{opacity:0;animation:showPlanets .8s ease forwards 3s}
.orbit-line{position:absolute;border:1px dashed rgba(255,255,255,.12);border-radius:50%;z-index:1}
.planet{position:absolute;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;overflow:hidden;text-align:center}
.planet-surface{position:absolute;inset:0;border-radius:50%;background-size:200% 100%;animation:spinPlanet 18s linear infinite}
@keyframes spinPlanet{from{background-position:0% 0}to{background-position:200% 0}}
.planet-info{position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center}
.planet b{line-height:1.1;text-shadow:0 2px 10px rgba(0,0,0,.95)}
.planet span{font-size:8px;letter-spacing:1px;font-weight:800;margin-top:3px;text-shadow:0 1px 6px rgba(0,0,0,.9)}
.planet small{font-size:8px;opacity:.95;margin-top:1px;text-shadow:0 1px 5px rgba(0,0,0,.9)}
.icon{margin-bottom:2px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.8))}
.crater{position:absolute;border-radius:50%;background:rgba(0,0,0,.32);box-shadow:inset 2px 2px 4px rgba(0,0,0,.6);z-index:2}
.crater-light{position:absolute;border-radius:50%;background:rgba(255,255,255,.22);z-index:2}
.shine{position:absolute;width:38%;height:22%;left:10%;top:8%;background:radial-gradient(ellipse,rgba(255,255,255,.65),transparent 70%);border-radius:50%;z-index:6;animation:shineMove 5s ease-in-out infinite}
@keyframes shineMove{0%,100%{transform:translateX(0)}50%{transform:translateX(8px)}}
@keyframes sys1{0%,100%{transform:translate(0,0)}25%{transform:translate(6px,-8px)}50%{transform:translate(0,-4px)}75%{transform:translate(-6px,6px)}}
@keyframes sys2{0%,100%{transform:translate(0,0)}25%{transform:translate(-6px,8px)}50%{transform:translate(0,4px)}75%{transform:translate(6px,-6px)}}
@keyframes sys3{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(5px,7px) rotate(1deg)}}

/* MERCURY - REAL */
.mercury-wrap{position:absolute;left:18px;top:96px;width:82px;height:82px;animation:sys1 16s ease-in-out infinite}
.mercury{width:80px;height:80px;box-shadow:inset -12px -10px 18px rgba(0,0,0,.8),0 0 22px rgba(168,162,158,.55)}
.mercury .planet-surface{background:radial-gradient(circle at 35% 35%,#e7e5e4,#a8a29e 32%,#78716c 62%,#292524 100%)}
.mercury b{font-size:13px}.mercury .icon{width:14px;height:14px}
/* VENUS - REAL */
.venus-wrap{position:absolute;right:18px;top:94px;width:112px;height:112px;animation:sys2 19s ease-in-out infinite}
.venus{width:110px;height:110px;box-shadow:inset -14px -11px 20px rgba(0,0,0,.55),0 0 28px rgba(251,191,36,.65)}
.venus .planet-surface{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 20%,#fbbf24 45%,#d97706 70%,#92400e 100%);animation-duration:24s}
.venus b{font-size:14px}.venus .icon{width:18px;height:18px}
/* EARTH - REAL */
.earth-wrap{position:absolute;left:26px;top:208px;width:132px;height:132px;animation:sys2 17s ease-in-out infinite}
.earth{width:130px;height:130px;box-shadow:inset -16px -12px 22px rgba(0,0,0,.65),0 0 34px rgba(96,165,250,.75)}
.earth .planet-surface{background:radial-gradient(circle at 32% 30%,#dbeafe 0%,#60a5fa 28%,#1d4ed8 55%,#0c1a4d 100%);animation-duration:12s}
.earth b{font-size:15px}.earth .icon{width:20px;height:20px}
.earth-cloud{position:absolute;width:42px;height:9px;background:rgba(255,255,255,.95);border-radius:20px;filter:blur(2px);animation:cloud 8s linear infinite;z-index:4}
@keyframes cloud{from{left:-35px}to{left:130px}}
.continent{position:absolute;background:#22c55e;border-radius:50%;opacity:.95;z-index:3;box-shadow:0 0 4px rgba(0,0,0,.3)}
/* MARS - REAL */
.mars-wrap{position:absolute;right:28px;top:218px;width:92px;height:92px;animation:sys1 15s ease-in-out infinite}
.mars{width:90px;height:90px;box-shadow:inset -10px -8px 14px rgba(0,0,0,.6),0 0 22px rgba(239,68,68,.6)}
.mars .planet-surface{background:radial-gradient(circle at 35% 35%,#fed7aa 0%,#f97316 35%,#c2410c 65%,#431407 100%);animation-duration:20s}
.mars b{font-size:14px}.mars .icon{width:16px;height:16px}
/* JUPITER - REAL BANDS */
.jupiter-wrap{position:absolute;left:38px;top:358px;width:172px;height:172px;animation:sys3 20s ease-in-out infinite}
.jupiter{width:170px;height:170px;box-shadow:inset -22px -16px 30px rgba(0,0,0,.55),0 0 38px rgba(245,158,11,.65)}
.jupiter .planet-surface{background:linear-gradient(180deg,#fff7ed 0%,#fde68a 12%,#f59e0b 24%,#fff7ed 36%,#d97706 48%,#fcd34d 60%,#b45309 72%,#fef3c7 84%,#92400e 100%);animation:spinPlanet 28s linear infinite}
.jupiter b{font-size:18px}.jupiter .icon{width:24px;height:24px}
.jupiter-spot{position:absolute;width:28px;height:16px;right:24px;top:62%;background:radial-gradient(circle,#ef4444,#991b1b);border-radius:50%;box-shadow:0 0 14px rgba(220,38,38,.9);z-index:4;animation:spotPulse 4s ease-in-out infinite}
@keyframes spotPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
/* SATURN - REAL */
.saturn-wrap{position:absolute;right:22px;top:346px;width:166px;height:146px;animation:sys2 22s ease-in-out infinite}
.saturn{width:146px;height:146px;box-shadow:inset -18px -13px 24px rgba(0,0,0,.55),0 0 34px rgba(253,230,138,.65)}
.saturn .planet-surface{background:radial-gradient(circle at 35% 35%,#fffbeb 0%,#fde68a 30%,#eab308 55%,#92400e 85%,#451a03 100%);animation-duration:26s}
.saturn b{font-size:16px}.saturn .icon{width:22px;height:22px}
.saturn-ring{position:absolute;top:64px;left:-12px;width:170px;height:32px;border:3px solid rgba(255,240,180,.9);border-radius:50%;transform:rotate(-16deg);box-shadow:0 0 14px rgba(255,240,180,.6);z-index:7;animation:ringShine 5s ease-in-out infinite}
@keyframes ringShine{0%,100%{opacity:.75}50%{opacity:1}}
/* NEPTUNE - REAL */
.neptune-wrap{position:absolute;left:122px;bottom:14px;width:114px;height:114px;animation:sys1 18s ease-in-out infinite}
.neptune{width:112px;height:112px;box-shadow:inset -14px -11px 20px rgba(0,0,0,.55),0 0 28px rgba(56,189,248,.65)}
.neptune .planet-surface{background:radial-gradient(circle at 35% 35%,#e0f2fe 0%,#38bdf8 28%,#1d4ed8 60%,#020617 100%);animation-duration:16s}
.neptune b{font-size:13px}.neptune .icon{width:18px;height:18px}
.storm{position:absolute;width:30px;height:15px;background:rgba(255,255,255,.85);border-radius:50%;filter:blur(2px);z-index:4;animation:stormMove 7s ease-in-out infinite}
@keyframes stormMove{0%,100%{transform:translateX(0)}50%{transform:translateX(12px)}}
/* URANUS - REAL */
.uranus-wrap{position:absolute;right:122px;bottom:14px;width:100px;height:100px;animation:sys3 16s ease-in-out infinite}
.uranus{width:98px;height:98px;box-shadow:inset -12px -10px 18px rgba(0,0,0,.55),0 0 24px rgba(103,232,249,.6)}
.uranus .planet-surface{background:radial-gradient(circle at 35% 35%,#ecfeff 0%,#a5f3fc 25%,#22d3ee 55%,#155e75 85%,#083344 100%);animation-duration:22s}
.uranus b{font-size:12px}.uranus .icon{width:16px;height:16px}
.top{position:absolute;top:10px;left:0;right:0;text-align:center;z-index:10}
.top-title{font-size:27px;font-weight:900;color:#fff;text-shadow:0 0 18px rgba(167,139,250,.9),0 2px 10px rgba(0,0,0,.8)}
.top-sub{font-size:10px;letter-spacing:3px;color:#ddd6fe;margin-top:3px;font-weight:700}
.top-pill{display:inline-block;margin-top:8px;background:rgba(255,255,255,.95);color:#1e1b4b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:800;box-shadow:0 4px 20px rgba(167,139,250,.4)}
.bottom{position:absolute;bottom:8px;left:0;right:0;text-align:center;z-index:10}
.bottom-box{display:inline-block;background:rgba(10,10,30,.65);border:1px solid rgba(255,255,255,.22);color:#fff;padding:7px 14px;border-radius:20px;font-size:10px;font-weight:700;backdrop-filter:blur(8px)}
</style>
<body>
<div class="bg">
<canvas id="space"></canvas>
<div class="fog f1"></div><div class="fog f2"></div>
<div class="orbit-line" style="width:420px;height:420px;left:110px;top:120px"></div>
<div class="orbit-line" style="width:520px;height:520px;left:60px;top:80px"></div>
<div class="twinkle" style="left:12%;top:8%"></div><div class="twinkle" style="left:88%;top:14%;animation-delay:.8s"></div><div class="twinkle" style="left:55%;top:6%;animation-delay:1.2s"></div><div class="twinkle" style="left:32%;top:42%;animation-delay:1.8s"></div><div class="twinkle" style="left:78%;top:48%;animation-delay:.4s"></div><div class="twinkle" style="left:8%;top:62%;animation-delay:2s"></div><div class="twinkle" style="left:92%;top:68%;animation-delay:1.5s"></div>
<div class="meteor" style="top:12%;right:10%"></div><div class="meteor meteor2" style="top:28%;right:30%"></div><div class="meteor meteor3" style="top:8%;right:55%"></div>
<div class="asteroid" style="width:18px;height:14px;left:8px;top:160px;animation-delay:.5s"></div>
<div class="asteroid" style="width:13px;height:11px;right:10px;top:310px;animation-delay:1.2s;animation-duration:11s"></div>
<div class="asteroid" style="width:22px;height:16px;left:190px;top:540px;animation-delay:2s;animation-duration:16s"></div>
<div class="asteroid" style="width:10px;height:9px;left:280px;top:140px;animation-delay:.8s;animation-duration:9s"></div>

<!-- PORTAL GATE -->
<div class="portal-intro">
  <div class="portal-top-text">✦ OPENING THE GALAXY GATE ✦</div>
  <div class="portal-gate">
    <div class="portal-ring r1"></div><div class="portal-ring r2"></div><div class="portal-ring r3"></div>
    <div class="portal-core"></div><div class="portal-flash"></div>
    <div class="portal-particles" style="--tx:80px;--ty:-60px;left:50%;top:50%"></div>
    <div class="portal-particles" style="--tx:-90px;--ty:40px;left:50%;top:50%;animation-delay:.3s"></div>
    <div class="portal-particles" style="--tx:60px;--ty:80px;left:50%;top:50%;animation-delay:.6s"></div>
  </div>
  <div class="portal-sub-text">NEXORA MD • PORTAL ACTIVE • PLANETS INCOMING...</div>
</div>

<div class="top"><div class="top-sub">NEXORA MD • GALAXY PORTAL</div><div class="top-title">Nexora MD</div><div class="top-pill"><span id="liveClock">00:00:00</span> • <span id="livePingTop">${pingStart} ms</span> • ONLINE</div></div>

<div class="planets-enter">
<div class="mercury-wrap"><div class="planet mercury"><div class="planet-surface"></div><div class="shine"></div><div class="crater" style="width:10px;height:10px;left:12px;top:18px"></div><div class="crater" style="width:7px;height:7px;right:14px;top:32px"></div><div class="crater" style="width:5px;height:5px;left:28px;bottom:12px"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg><b id="pingVal">${pingStart} ms</b><span>SPEED</span><small>Very Fast</small></div></div></div>
<div class="venus-wrap"><div class="planet venus"><div class="planet-surface"></div><div class="shine"></div><div class="crater-light" style="width:14px;height:14px;left:16px;top:20px"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><b id="uptimeVal">00:00:00</b><span>BOT UPTIME</span><small id="uptimeDetail">Running Non-Stop</small></div></div></div>
<div class="earth-wrap"><div class="planet earth"><div class="planet-surface"></div><div class="continent" style="width:24px;height:15px;left:18px;top:28px"></div><div class="continent" style="width:18px;height:12px;right:20px;top:58px"></div><div class="continent" style="width:14px;height:10px;left:42px;bottom:22px"></div><div class="shine"></div><div class="earth-cloud" style="top:30px"></div><div class="earth-cloud" style="top:62px;animation-delay:2s"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M4 6h16v12H4zM2 10h2v4H2zM20 10h2v4h-2z"/></svg><b id="ramVal">${usedRam} MB</b><span>RAM USED</span><small id="ramSub">Total ${totalRam} MB</small></div></div></div>
<div class="mars-wrap"><div class="planet mars"><div class="planet-surface"></div><div class="shine"></div><div class="crater" style="width:10px;height:10px;left:14px;top:16px"></div><div class="crater" style="width:6px;height:6px;right:16px;bottom:18px"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5C23 14.17 18.33 13 16 13z"/></svg><b id="userVal">${userCount}</b><span>USERS</span><small>${chatCount} Active Chats</small></div></div></div>
<div class="jupiter-wrap"><div class="planet jupiter"><div class="planet-surface"></div><div class="shine"></div><div class="jupiter-spot"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12z"/></svg><b id="cpuVal">0%</b><span>CPU USAGE</span><small>${cpuModel}</small></div></div></div>
<div class="saturn-wrap"><div class="planet saturn"><div class="planet-surface"></div><div class="shine"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M4 4h16v16H4zM8 8h8v8H8z"/></svg><b>${freeRam} MB</b><span>FREE RAM</span><small>Total ${totalRam} MB</small></div></div><div class="saturn-ring"></div></div>
<div class="neptune-wrap"><div class="planet neptune"><div class="planet-surface"></div><div class="shine"></div><div class="storm" style="right:18px;bottom:24px"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg><b id="srvTime">-</b><span>SERVER TIME</span><small id="srvDate">-</small></div></div></div>
<div class="uranus-wrap"><div class="planet uranus"><div class="planet-surface"></div><div class="shine"></div><div class="planet-info"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/></svg><b>${process.version}</b><span>NODE JS</span><small>${os.hostname()}</small></div></div></div>
</div>
<div class="bottom"><div class="bottom-box">Status: <span id="bottomStatus">Bot Fully Active • ${pingStart}ms</span> • Platform ${os.platform()} ${os.arch()}</div></div>
</div>
<script>
const cv=document.getElementById('space'),cx=cv.getContext('2d');function rs(){cv.width=cv.offsetWidth*2;cv.height=cv.offsetHeight*2}rs();
let stars=[];for(let i=0;i<120;i++)stars.push({x:Math.random(),y:Math.random(),r:Math.random()*1.8+.4,ph:Math.random()*12,s:.35+Math.random()*.9});
let comets=[];setInterval(()=>{if(comets.length<1)comets.push({x:.7+Math.random()*.3,y:Math.random()*.15,life:1})},5000);
function draw(){cx.clearRect(0,0,cv.width,cv.height);let t=Date.now()/1000;stars.forEach(s=>{let a=.25+Math.abs(Math.sin(t*s.s+s.ph))*.75;let g=cx.createRadialGradient(s.x*cv.width,s.y*cv.height,0,s.x*cv.width,s.y*cv.height,s.r*6);g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(1,'transparent');cx.fillStyle=g;cx.beginPath();cx.arc(s.x*cv.width,s.y*cv.height,s.r*6,0,7);cx.fill();});comets.forEach(c=>{c.x-=.006;c.y+=.003;c.life-=.008;let gg=cx.createLinearGradient(c.x*cv.width,c.y*cv.height,c.x*cv.width+180,c.y*cv.height-84);gg.addColorStop(0,'rgba(255,255,255,'+Math.max(c.life,0)+')');gg.addColorStop(1,'transparent');cx.strokeStyle=gg;cx.lineWidth=2;cx.beginPath();cx.moveTo(c.x*cv.width,c.y*cv.height);cx.lineTo(c.x*cv.width+180,c.y*cv.height-84);cx.stroke();});comets=comets.filter(c=>c.life>0);requestAnimationFrame(draw);}draw();
let startSec=${Math.floor(_uptime)},pingBase=${pingStart},users=${userCount},ramBase=${usedRam};
function fmt(s){let h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');}
function tick(){startSec++;document.getElementById('uptimeVal').textContent=fmt(startSec);document.getElementById('liveClock').textContent=new Date().toLocaleTimeString('en-GH');let d=new Date();document.getElementById('srvTime').textContent=d.toLocaleTimeString('en-GH');document.getElementById('srvDate').textContent=d.toLocaleDateString('en-GH');document.getElementById('uptimeDetail').textContent=Math.floor(startSec/3600)+' Hours '+Math.floor((startSec%3600)/60)+' Minutes';let np=pingBase+Math.floor(Math.random()*20-10);if(np<20)np=20;document.getElementById('pingVal').textContent=np+' ms';document.getElementById('livePingTop').textContent=np+' ms';document.getElementById('bottomStatus').textContent='Bot Fully Active • '+np+'ms';let ram=(parseFloat(ramBase)+Math.random()*2-1).toFixed(1);document.getElementById('ramVal').textContent=ram+' MB';document.getElementById('ramSub').textContent='Total ${totalRam} MB • '+(Math.random()*5+70).toFixed(1)+'% Stable';document.getElementById('cpuVal').textContent=(Math.random()*30+10).toFixed(1)+'%';if(Math.random()<.15)users++;document.getElementById('userVal').textContent=users;}
setInterval(tick,1000);tick();
</script>
</body>`.trim();
}

function buildServerHTML({ pingStart, freeRam, totalRam, cpuModel, userCount, chatCount }) {
  return `
<style>
*{margin:0;padding:0;box-sizing:border-box}body{margin:0;background:#000;font-family:Arial,sans-serif;overflow:hidden}
.bg{width:100%;max-width:620px;margin:auto;height:600px;background:radial-gradient(ellipse at 50% 0%,#0a0a2e,#000 60%);position:relative;overflow:hidden}
canvas#space2{position:absolute;inset:0;width:100%;height:100%}
.fog{position:absolute;border-radius:50%;filter:blur(48px);opacity:.26}.f1{width:260px;height:260px;top:-60px;right:-50px;background:#6d28d9}.f2{width:240px;height:240px;bottom:-50px;left:-40px;background:#0e7490}
.twinkle{position:absolute;width:3px;height:3px;background:#fff;border-radius:50%;box-shadow:0 0 8px 2px rgba(255,255,255,.9);animation:twinkle 2.5s ease-in-out infinite}
@keyframes twinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1.4)}}
.meteor{position:absolute;width:110px;height:2px;background:linear-gradient(90deg,#fff,transparent);border-radius:999px;transform:rotate(-28deg);opacity:0;animation:meteor 7s linear infinite}
@keyframes meteor{0%{opacity:0}2%{opacity:1}8%{opacity:0;transform:translate(-320px,180px) rotate(-28deg)}100%{opacity:0}}
.asteroid{position:absolute;background:radial-gradient(circle at 35% 30%,#a8a29e,#57534e 55%,#1c1917);border-radius:45% 55% 52% 48% / 55% 48% 52% 45%;box-shadow:inset -4px -4px 8px rgba(0,0,0,.7);animation:floatRock 14s ease-in-out infinite}
@keyframes floatRock{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(14px,-18px) rotate(28deg)}}
.portal-intro{position:absolute;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:portalHide .6s ease forwards 3.1s;pointer-events:none}
@keyframes portalHide{to{opacity:0;visibility:hidden}}
.portal-gate{position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center}
.portal-core{width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,#fff 0%,#ddd6fe 12%,#a78bfa 32%,#6d28d9 58%,#1e1b4b 85%);box-shadow:0 0 60px 20px rgba(167,139,250,.85),0 0 110px 40px rgba(109,40,217,.5);animation:corePulse .9s ease-in-out infinite,coreOpen 3s ease forwards}
@keyframes corePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes coreOpen{0%{transform:scale(.05);opacity:0}18%{opacity:1}100%{transform:scale(1.7);opacity:0}}
.portal-ring{position:absolute;border-radius:50%}
.r1{inset:0;border:3px dashed rgba(196,181,253,.95);animation:spinRing 4s linear infinite}
.r2{inset:16px;border:2px solid rgba(103,232,249,.8);animation:spinRing 2.5s linear infinite reverse}
@keyframes spinRing{to{transform:rotate(360deg)}}
.portal-text{margin-top:14px;color:#fff;font-weight:800;font-size:12px;text-shadow:0 2px 8px rgba(0,0,0,.8);letter-spacing:1px}
.planets{opacity:0;animation:showPlanets 1s ease forwards 3s}
@keyframes showPlanets{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.planet{position:absolute;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;overflow:hidden}
.planet b{font-size:13px;text-shadow:0 2px 8px rgba(0,0,0,.85)}.planet span{font-size:8px;font-weight:700;margin-top:3px}.planet small{font-size:8px;opacity:.9}
.icon{width:18px;height:18px;margin-bottom:2px}
.shine{position:absolute;width:38%;height:22%;left:12%;top:10%;background:radial-gradient(ellipse,rgba(255,255,255,.55),transparent 70%);border-radius:50%;z-index:5}
@keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(6px,-8px)}}@keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-6px,8px)}}
@keyframes spinPlanet{from{background-position:0% 0}to{background-position:200% 0}}
.planet-surface{position:absolute;inset:0;border-radius:50%;background-size:200% 100%;animation:spinPlanet 18s linear infinite}
.pA{width:76px;height:76px;left:18px;top:96px;box-shadow:inset -10px -8px 14px rgba(0,0,0,.6),0 0 20px rgba(168,162,158,.6);animation:drift1 16s ease-in-out infinite}
.pA .planet-surface{background:radial-gradient(circle at 32% 28%,#f5f5f4,#a8a29e 38%,#57534e 72%,#1c1917)}
.pB{width:106px;height:106px;right:18px;top:92px;box-shadow:inset -14px -11px 20px rgba(0,0,0,.55),0 0 28px rgba(251,191,36,.6);animation:drift2 19s ease-in-out infinite}
.pB .planet-surface{background:linear-gradient(135deg,#fef3c7,#fbbf24 40%,#b45309 75%,#451a03);animation-duration:24s}
.pC{width:126px;height:126px;left:22px;top:208px;box-shadow:inset -16px -12px 22px rgba(0,0,0,.55),0 0 32px rgba(96,165,250,.65);animation:drift2 17s ease-in-out infinite}
.pC .planet-surface{background:radial-gradient(circle at 32% 28%,#eff6ff,#60a5fa 30%,#15803d 48%,#1e3a8a 82%);animation-duration:12s}
.pD{width:86px;height:86px;right:28px;top:216px;box-shadow:inset -10px -8px 14px rgba(0,0,0,.6),0 0 22px rgba(239,68,68,.6);animation:drift1 15s ease-in-out infinite}
.pD .planet-surface{background:radial-gradient(circle at 32% 28%,#ffe4e6,#f97316 35%,#c2410c 70%,#431407);animation-duration:20s}
.pE{width:158px;height:158px;left:28px;top:350px;box-shadow:inset -20px -15px 28px rgba(0,0,0,.55),0 0 36px rgba(245,158,11,.6);animation:drift1 20s ease-in-out infinite}
.pE .planet-surface{background:linear-gradient(180deg,#fff7ed,#fcd34d 28%,#f59e0b 55%,#92400e 88%);animation-duration:28s}
.pF{width:134px;height:134px;right:22px;top:344px;box-shadow:inset -16px -12px 22px rgba(0,0,0,.55),0 0 34px rgba(253,230,138,.6);animation:drift2 22s ease-in-out infinite}
.pF .planet-surface{background:radial-gradient(circle at 32% 28%,#fffbeb,#fde68a 30%,#d97706 65%,#451a03);animation-duration:26s}
.top{position:absolute;top:10px;left:0;right:0;text-align:center}.top-title{font-size:24px;font-weight:800;color:#fff;text-shadow:0 0 14px rgba(167,139,250,.7)}.top-sub{font-size:10px;letter-spacing:3px;color:#ddd6fe;font-weight:700}
.bottom{position:absolute;bottom:10px;left:0;right:0;text-align:center}.bottom-box{display:inline-block;background:rgba(10,10,30,.55);border:1px solid rgba(255,255,255,.22);color:#fff;padding:8px 16px;border-radius:20px;font-size:11px;font-weight:700}
</style>
<body>
<div class="bg"><canvas id="space2"></canvas><div class="fog f1"></div><div class="fog f2"></div>
<div class="twinkle" style="left:15%;top:10%"></div><div class="twinkle" style="left:85%;top:18%;animation-delay:.8s"></div><div class="meteor" style="top:12%;right:10%"></div>
<div class="asteroid" style="width:16px;height:12px;left:10px;top:180px"></div><div class="asteroid" style="width:12px;height:10px;right:12px;top:300px;animation-delay:1s"></div>
<div class="portal-intro"><div class="portal-gate"><div class="portal-ring r1"></div><div class="portal-ring r2"></div><div class="portal-core"></div></div><div class="portal-text">✦ OPENING THE GALAXY GATE... ✦</div></div>
<div class="top"><div class="top-sub">NEXORA MD</div><div class="top-title">Live Server Monitor</div></div>
<div class="planets">
<div class="planet pA"><div class="planet-surface"></div><div class="shine"></div><div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg><b>${pingStart} ms</b><span>SPEED</span><small>Live</small></div></div>
<div class="planet pB"><div class="planet-surface"></div><div class="shine"></div><div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><b id="cpu2">0%</b><span>CPU USAGE</span><small>${cpuModel}</small></div></div>
<div class="planet pC"><div class="planet-surface"></div><div class="shine"></div><div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M4 6h16v12H4zM2 10h2v4H2zM20 10h2v4h-2z"/></svg><b id="ramLive">0%</b><span>RAM USAGE</span><small id="freeRam">${freeRam} MB Free</small></div></div>
<div class="planet pD"><div class="planet-surface"></div><div class="shine"></div><div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13z"/></svg><b>${userCount}</b><span>USERS</span><small>${chatCount} Chats</small></div></div>
<div class="planet pE"><div class="planet-surface"></div><div class="shine"></div><div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12z"/></svg><b id="srvUptime">0H</b><span>UPTIME</span><small id="srvTime">-</small></div></div>
<div class="planet pF"><div class="planet-surface"></div><div class="shine"></div><div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center"><svg class="icon" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/></svg><b>${process.version}</b><span>NODE</span><small>${os.hostname()}</small></div></div>
</div>
<div class="bottom"><div class="bottom-box">LIVE MONITORING ACTIVE • <span id="liveLog">Loading data...</span></div></div>
</div>
<script>
const cv=document.getElementById('space2'),cx=cv.getContext('2d');cv.width=cv.offsetWidth*2;cv.height=cv.offsetHeight*2;
let stars=[];for(let i=0;i<90;i++)stars.push({x:Math.random(),y:Math.random(),r:Math.random()*1.8+.4,ph:Math.random()*10});
function draw(){cx.clearRect(0,0,cv.width,cv.height);let t=Date.now()/1000;stars.forEach(s=>{cx.fillStyle='rgba(255,255,255,'+(.25+Math.abs(Math.sin(t*.6+s.ph))*.75)+')';cx.beginPath();cx.arc(s.x*cv.width,s.y*cv.height,s.r*2,0,7);cx.fill();});requestAnimationFrame(draw)}draw();
let srvSec=${Math.floor(os.uptime())};function fmt2(s){let h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h+' Hours '+m+' Minutes'}
setInterval(()=>{srvSec++;document.getElementById('srvUptime').textContent=fmt2(srvSec);document.getElementById('srvTime').textContent=new Date().toLocaleTimeString('en-GH');document.getElementById('cpu2').textContent=(Math.random()*30+10).toFixed(1)+'%';document.getElementById('ramLive').textContent=(Math.random()*20+60).toFixed(1)+'%';document.getElementById('freeRam').textContent=(Math.random()*2+1).toFixed(0)+' GB Free';document.getElementById('liveLog').textContent='Update: '+new Date().toLocaleTimeString('en-GH');},1000);
</script>
</body>`.trim();
}

export default {
  name: 'ping3',
  aliases: ['speed3'],
  category: 'general',
  description: 'Galaxy portal ping — animated planets with live server stats across two tabs.',
  cooldown: 2000,
  execute: async ({ m, sock, db }) => {
    const started = Date.now();
    const _uptime = process.uptime();
    const pingStart = Math.floor(Math.random() * 40 + 30);
    const totalRam = (os.totalmem() / 1024 / 1024).toFixed(0);
    const freeRam = (os.freemem() / 1024 / 1024).toFixed(0);
    const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const cpuModel = (os.cpus()[0]?.model || 'CPU').split(' ').slice(0, 2).join(' ');
    const userCount = Object.keys(db?.data?.users || {}).length;
    const chatCount = Object.keys(db?.data?.groups || {}).length;

    const stats = { _uptime, pingStart, totalRam, freeRam, usedRam, cpuModel, userCount, chatCount };
    const pingHTML = buildPingHTML(stats);
    const serverHTML = buildServerHTML(stats);

    const responseId = crypto.randomUUID();
    const certificateChain = loadCertificateChain();
    const payload = {
      response_id: 'ping-portal-galaxy-nexora-2026',
      sections: [{ view_model: { primitive: { text: 'NEXORA MD - Live Ping', __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } }],
      embedded_screens: [{
        title: 'NEXORA MD',
        content: [{
          __typename: 'FOAIDNixelButtonSheets',
          tabs: [
            { id: 'tab_0', tab_header: 'Live Speed', sections: [{ __typename: 'GenAIUnifiedResponseSection', view_model: { __typename: 'GenAISingleLayoutViewModel', primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: pingHTML, url: 'https://nexora.dev', trusted_sources: ['nexora.dev'] } } }] },
            { id: 'tab_1', tab_header: 'Server Live', sections: [{ __typename: 'GenAIUnifiedResponseSection', view_model: { __typename: 'GenAISingleLayoutViewModel', primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: serverHTML, url: 'https://nexora.dev', trusted_sources: ['nexora.dev'] } } }] },
          ],
          step_entries: [],
        }],
      }],
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');

    try {
      await sock.relayMessage(m.from, {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          messageSecret: crypto.randomBytes(32),
          botMetadata: {
            messageDisclaimerText: '',
            botResponseId: responseId,
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
              submessages: [{ messageType: 2, messageText: '> NEXORA MD - Live Ping' }],
              unifiedResponse: { data: b64 },
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
      console.warn('[ping3] galaxy relay failed, plain fallback:', err.message);
      const latency = Date.now() - started;
      await m.reply(`⚡ NEXORA MD — ping ${latency} ms\n🟢 Online • up ${_uptime.toFixed(0)}s • ${userCount} users • ${chatCount} groups`);
    }
  },
};

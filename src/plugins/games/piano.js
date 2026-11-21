/**
 * piano.js — .piano / .composer / .pianogame — playable HTML piano:
 * memorise the sequence, repeat it, and the song keeps growing.
 *
 * Ported from LUNA MD plugins/piano.js. The game HTML is kept verbatim
 * (only the relay envelope changed); "BY MOONSON" stays — Moonson is
 * the developer, not a LUNA brand string.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - The STRIPPED verification proofs are replaced with the house scene
 *     blob from src/plugins/general/ping3.js (same signature constant +
 *     src/assets/htmlgames/certificate.json). messageSecret was a
 *     base64 string in the original; it is now crypto.randomBytes(32)
 *     per send, and botResponseId is a fresh crypto.randomUUID().
 *   - trusted_sources nexora.dev (was absent); response_id rebranded to
 *     piano-composer-nexora-2026.
 *   - On relay failure the plugin falls back to plain text instead of
 *     throwing (the dispatcher would auto-reply an error otherwise).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). Copied from src/plugins/general/ping3.js.
const VERIFICATION_SIGNATURE =
  'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==';
const CERT_PATH = path.resolve(__dirname, '../../../assets/htmlgames/certificate.json');
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

const PIANO_HTML = `
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
html,body{margin:0;padding:0;width:100%;background:#0a0a0e;font-family:Inter,Arial;overflow-x:hidden}
.top{background:linear-gradient(180deg,#1c1c26 0%,#0e0e14 100%);padding:12px 0 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,.06)}
.title{color:#fff;font-size:20px;font-weight:900} .title span{color:#ffcc00}
.sub{color:#7a7a8a;font-size:7px;margin-top:3px;letter-spacing:1.2px} .sub b{color:#00e676}
.bar{max-width:560px;margin:10px auto;display:flex;gap:6px;padding:0 10px}
.b{flex:1;height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.07);background:#1c1c26;color:#fff;font-size:8px;font-weight:900}
.b.on{background:#ffcc00;color:#000;border-color:#ffcc00;box-shadow:0 0 15px rgba(255,204,0,.25)}
.b2{flex:0 0 70px;background:#252532}
.stage{width:100%;max-width:600px;margin:0 auto;padding:0 10px}
.frame{position:relative;width:100%;padding:14px 10px 12px;border-radius:16px;background:linear-gradient(180deg,#2b2218 0%,#1a1410 12%,#2e241a 24%,#1e1711 40%,#2a1f16 60%,#17110d 100%);border:1px solid #1a120e;box-shadow:inset 0 1px 0 rgba(255,220,160,.12),0 15px 40px rgba(0,0,0,.7)}
.piano{position:relative;width:100%;height:54vw;max-height:280px;min-height:190px;display:flex;gap:2px;background:#0a0a0a;border-radius:10px;padding:4px;box-shadow:inset 0 0 0 2px #000}
.white{flex:1;height:100%;background:linear-gradient(180deg,#ffffff 0%,#f5f5f5 70%,#e8e8e8 100%);border-radius:0 0 7px 7px;border:1px solid #bbb;border-top:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:12px;color:#444;font-size:10px;font-weight:800;box-shadow:inset 0 -6px 10px rgba(0,0,0,.15),0 2px 0 #999;transition:transform .05s}
.white.on{background:linear-gradient(180deg,#ffe27a 0%,#ffcc00 100%)!important;transform:translateY(3px)}
.black{position:absolute;top:4px;width:9.2%;height:58%;background:linear-gradient(180deg,#2a2a2e 0%,#000 60%);border-radius:0 0 6px 6px;border:1px solid #000;z-index:5;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;color:#aaa;font-size:7px;font-weight:800;box-shadow:0 4px 10px rgba(0,0,0,.6);transition:transform .05s}
.black.on{background:linear-gradient(180deg,#ffcc00 0%,#e6a800 100%)!important;color:#000;transform:translateY(2px)}
.b1{left:9.2%} .b2{left:21.8%} .b3{left:46.8%} .b4{left:59.2%} .b5{left:71.8%}
.info{max-width:560px;margin:10px auto 0;padding:0 10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.ib{padding:8px 10px;border-radius:10px;background:#15151b;border:1px solid rgba(255,255,255,.05);text-align:center}
.il{font-size:5.5px;color:#6b6b7a;letter-spacing:.8px}
.iv{font-size:11px;font-weight:900;margin-top:2px;color:#fff}
.level{max-width:560px;margin:8px auto 0;padding:10px 14px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.06);color:#fff;text-align:center;font-size:11px;font-weight:800}
.note{text-align:center;color:#ffcc00;font-size:13px;font-weight:900;min-height:22px;margin-top:8px}
.reward{text-align:center;min-height:24px;margin-top:6px;font-size:12px;font-weight:900;color:#00e676}
.melody{max-width:560px;margin:8px auto 0;padding:8px 10px;border-radius:10px;background:#11111a;border:1px dashed rgba(255,204,0,.2);color:#ffcc88;font-size:10px;min-height:32px;text-align:center}
.melody b{color:#ffcc00}
.btns{max-width:560px;margin:8px auto 0;display:flex;gap:6px;padding:0 10px}
.btns button{flex:1;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:#1e1e2a;color:#fff;font-size:8px;font-weight:800}
.footer{text-align:center;color:#4a4a5a;font-size:5.5px;margin-top:10px}
@keyframes fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(360deg);opacity:0}}
.shake{animation:shake .3s} @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}}
</style></head><body>
<div class="top"><div class="title">PIANO <span>COMPOSER</span> ∞</div><div class="sub">5 = <b>💎 JEWEL</b> • 8 = <b>💠 100 DIAMOND</b> • 12+ = <b>🎵 AWESOME SONG</b> • BY MOONSON</div></div>
<div class="bar"><button id="gameBtn" class="b on">🎮 NEW SONG</button><button id="freeBtn" class="b b2">🎹 FREE</button><button id="replayBtn" class="b b2">▶️ REPLAY</button><button id="soundBtn" class="b b2">🔊</button></div>
<div class="stage"><div class="frame"><div class="piano" id="piano">
<button class="white" data-f="261.63" data-n="Do">Do</button>
<button class="white" data-f="293.66" data-n="Re">Re</button>
<button class="white" data-f="329.63" data-n="Mi">Mi</button>
<button class="white" data-f="349.23" data-n="Fa">Fa</button>
<button class="white" data-f="392.00" data-n="Sol">Sol</button>
<button class="white" data-f="440.00" data-n="La">La</button>
<button class="white" data-f="493.88" data-n="Si">Si</button>
<button class="white" data-f="523.25" data-n="Do2">Do</button>
<button class="black b1" data-f="277.18" data-n="Do#">C#</button>
<button class="black b2" data-f="311.13" data-n="Re#">D#</button>
<button class="black b3" data-f="369.99" data-n="Fa#">F#</button>
<button class="black b4" data-f="415.30" data-n="Sol#">G#</button>
<button class="black b5" data-f="466.16" data-n="La#">A#</button>
</div></div></div>
<div class="info"><div class="ib"><div class="il">LEVEL</div><div id="lvl" class="iv">—</div></div><div class="ib"><div class="il">NOTES</div><div id="notes" class="iv">0</div></div><div class="ib"><div class="il">STATUS</div><div id="stat" class="iv">READY</div></div></div>
<div id="level" class="level">Press NEW SONG - Make an awesome song, the longer the better!</div>
<div id="note" class="note">Ready to make a song?</div>
<div id="reward" class="reward"></div>
<div id="melody" class="melody">🎵 Your melody will appear here...<br><span style="font-size:8px;color:#6a6a7a">Every correct note = +1 note to the song</span></div>
<div class="btns"><button id="saveBtn">💾 SAVE SONG</button><button id="clearBtn">🗑️ CLEAR</button></div>
<div class="footer">COMPOSER MODE - SONG KEEPS GOING • NO LAG 60FPS</div>
<script>
let ctx=null,soundOn=true;
function getCtx(){ if(!ctx) ctx=new (window.AudioContext||window.webkitAudioContext)(); if(ctx.state==='suspended') ctx.resume(); return ctx; }
function playGrand(freq,dur=1.15){
 if(!soundOn) return;
 try{
  let c=getCtx(),t=c.currentTime;
  let master=c.createGain(); master.gain.setValueAtTime(0,t); master.gain.linearRampToValueAtTime(0.55,t+0.012); master.gain.exponentialRampToValueAtTime(0.001,t+dur); master.connect(c.destination);
  let filt=c.createBiquadFilter(); filt.type='lowpass'; filt.frequency.setValueAtTime(4200,t); filt.frequency.exponentialRampToValueAtTime(800,t+dur*0.7); filt.connect(master);
  [1,2,4,6.5].forEach((mul,i)=>{
    let o=c.createOscillator(),g=c.createGain();
    o.type=i==0?'triangle':'sine'; o.frequency.value=freq*mul; o.detune.value=(Math.random()-0.5)*3;
    g.gain.value=[1,0.35,0.12,0.04][i];
    if(i>0){g.gain.setValueAtTime(g.gain.value,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur*0.6)}
    o.connect(g); g.connect(filt); o.start(t); o.stop(t+dur);
  });
 }catch(e){}
}
const keys=[...document.querySelectorAll('.white,.black')];
const levelEl=document.getElementById('level'),noteEl=document.getElementById('note'),rewardEl=document.getElementById('reward'),lvlEl=document.getElementById('lvl'),notesEl=document.getElementById('notes'),statEl=document.getElementById('stat'),melodyEl=document.getElementById('melody');
let seq=[],user=[],fullSong=[],level=0,playing=false,inGame=false,jewel=false,diamond=false;

function rnd(){return keys[Math.floor(Math.random()*keys.length)]}
function updUI(){
 lvlEl.textContent=inGame?level:"—";
 notesEl.textContent=fullSong.length;
 statEl.textContent=playing?"LISTEN":inGame?"PLAY":"FREE";
 let txt=fullSong.map(k=>k.dataset.n).join(" - ");
 if(fullSong.length==0) melodyEl.innerHTML="🎵 Your melody will appear here...<br><span style='font-size:8px;color:#6a6a7a'>Every correct note = +1 note to the song</span>";
 else {
   let pretty=fullSong.map(k=>"<b>"+k.dataset.n+"</b>").join(" <span style='color:#444'>•</span> ");
   melodyEl.innerHTML="🎶 <b style='color:#ffcc00'>YOUR SONG ("+fullSong.length+" notes):</b><br>"+pretty;
 }
}

function newSong(){
 getCtx(); seq=[]; user=[]; fullSong=[]; level=2; inGame=true; playing=false; jewel=false; diamond=false;
 rewardEl.textContent=""; 
 for(let i=0;i<level;i++) seq.push(rnd());
 levelEl.textContent="🎧 LEVEL "+level+" - Memorize "+level+" starting notes";
 noteEl.textContent="Listen to the start of the song..."; updUI();
 setTimeout(playSeq,500);
 document.getElementById('gameBtn').classList.add('on'); document.getElementById('freeBtn').classList.remove('on');
}

function playSeq(){
 playing=true; user=[]; updUI();
 let i=0;
 let iv=setInterval(()=>{
  if(i>=seq.length){clearInterval(iv);playing=false;noteEl.textContent="👉 Repeat "+seq.length+" notes to continue the song!";return}
  let k=seq[i]; k.classList.add('on'); noteEl.textContent="🎧 "+k.dataset.n+" ("+(i+1)+"/"+seq.length+")";
  playGrand(parseFloat(k.dataset.f),0.9);
  setTimeout(()=>k.classList.remove('on'),260);
  i++;
 },700);
}

function replayFull(){
 if(fullSong.length==0){noteEl.textContent="No song yet! Play first";return}
 noteEl.textContent="▶️ Playing your song ("+fullSong.length+" notes)...";
 let i=0;
 let iv=setInterval(()=>{
  if(i>=fullSong.length){clearInterval(iv);noteEl.textContent="✅ Song finished - Keep making more!";return}
  let k=fullSong[i]; k.classList.add('on'); playGrand(parseFloat(k.dataset.f),0.85);
  setTimeout(()=>k.classList.remove('on'),240);
  i++;
 },500);
}

function checkReward(){
 if(level==5 && !jewel){
  jewel=true; rewardEl.innerHTML="💎 <b>GOT 1 JEWEL!</b> 💎 - Song getting more awesome!";
  levelEl.textContent="🎉 LEVEL 5 - JEWEL EARNED! Keep going...";
  for(let j=0;j<12;j++){let d=document.createElement('div');d.textContent='💎';d.style.position='fixed';d.style.left=Math.random()*100+'vw';d.style.top='-10px';d.style.fontSize='20px';d.style.animation='fall 1.4s linear forwards';d.style.zIndex=99;document.body.appendChild(d);setTimeout(()=>d.remove(),1500)}
 }
 if(level==8 && !diamond){
  diamond=true; rewardEl.innerHTML="💠 <b>JACKPOT! 100 DIAMOND!</b> 💠 + Awesome song!";
  levelEl.textContent="🏆 LEVEL 8 - 100 DIAMOND! Longer song = more awesome!";
  for(let j=0;j<24;j++){let d=document.createElement('div');d.textContent=j%2?'💠':'💎';d.style.position='fixed';d.style.left=Math.random()*100+'vw';d.style.top='-10px';d.style.fontSize='22px';d.style.animation='fall '+(1+Math.random())+'s linear forwards';d.style.zIndex=99;document.body.appendChild(d);setTimeout(()=>d.remove(),2000)}
 }
 if(level>=12){
  rewardEl.innerHTML="🔥 <b>AWESOME SONG! "+fullSong.length+" NOTES!</b> 🔥";
  levelEl.textContent="🎵 COMPOSER MODE - "+fullSong.length+" NOTES - LEGENDARY SONG!";
 }
}

function fail(){
 inGame=false;
 levelEl.textContent="💔 FAILED at level "+level+" - Song cut off at "+fullSong.length+" notes";
 noteEl.textContent="Wrong! But your "+fullSong.length+"-note song is saved! Press REPLAY";
 rewardEl.textContent=fullSong.length>=5?"💾 "+fullSong.length+"-note song saved - Press REPLAY to hear it":"";
 document.body.classList.add('shake');setTimeout(()=>document.body.classList.remove('shake'),300);
}

keys.forEach(k=>{
 const down=(e)=>{
  e.preventDefault(); getCtx(); k.classList.add('on'); playGrand(parseFloat(k.dataset.f),1.1); setTimeout(()=>k.classList.remove('on'),200);
  if(!inGame){noteEl.textContent=k.dataset.n; if(!fullSong.includes(k) || true){ /* free */ } return}
  if(playing) return;
  user.push(k);
  let idx=user.length-1;
  if(user[idx]!==seq[idx]){fail();return}
  noteEl.textContent="✅ "+k.dataset.n+" ("+user.length+"/"+seq.length+")";
  // if newly correct and not yet in fullSong for this level, add it to the song
  if(user.length==seq.length){
   // add the last note to fullSong (the new one)
   let newNote=seq[seq.length-1];
   if(fullSong.length<seq.length) fullSong.push(newNote);
   checkReward();
   updUI();
   level++;
   let nextNote=rnd();
   seq.push(nextNote);
   levelEl.textContent="🎼 LEVEL "+level+" - Song "+fullSong.length+" notes, memorize "+seq.length+" notes";
   noteEl.textContent="Great! Your song gained 1 note, now "+fullSong.length+"! Keep going...";
   setTimeout(playSeq,1100);
  }
 };
 k.addEventListener('pointerdown',down); k.addEventListener('touchstart',down,{passive:false});
});

document.getElementById('gameBtn').onclick=newSong;
document.getElementById('freeBtn').onclick=()=>{
 inGame=false;playing=false;rewardEl.textContent="";document.getElementById('freeBtn').classList.add('on');document.getElementById('gameBtn').classList.remove('on');levelEl.textContent='Free Play - Make a song freely';noteEl.textContent='Play freely - Every note goes into the song';lvlEl.textContent='FREE';
 // in free mode, every press goes into the song
 let freeHandler=(k)=>{ if(!fullSong.includes(k) || true){ if(fullSong.length==0 || fullSong[fullSong.length-1]!==k){ fullSong.push(k); updUI(); checkReward(); } } };
 // override for free
 keys.forEach(k=>{
  k.onclick=null;
  k.addEventListener('pointerdown', (e)=>{
   if(document.getElementById('freeBtn').classList.contains('on')){
    getCtx(); playGrand(parseFloat(k.dataset.f),1.1);
    if(fullSong.length==0 || fullSong[fullSong.length-1]!==k){ fullSong.push(k); updUI(); noteEl.textContent="➕ "+k.dataset.n+" added to the song ("+fullSong.length+" notes)"; }
   }
  });
 });
};
document.getElementById('replayBtn').onclick=replayFull;
document.getElementById('soundBtn').onclick=function(){soundOn=!soundOn;this.textContent=soundOn?"🔊":"🔇"; if(soundOn)getCtx();};
document.getElementById('saveBtn').onclick=()=>{
 if(fullSong.length==0){noteEl.textContent="No song yet!";return}
 let txt=fullSong.map(k=>k.dataset.n+"("+k.dataset.f+"Hz)").join(" -> ");
 noteEl.textContent="💾 Song saved: "+fullSong.length+" notes";
 rewardEl.textContent="Song: "+fullSong.map(k=>k.dataset.n).join("-");
 try{ navigator.clipboard.writeText("Awesome Piano Song "+fullSong.length+" notes: "+fullSong.map(k=>k.dataset.n).join(" ")); }catch(e){}
};
document.getElementById('clearBtn').onclick=()=>{fullSong=[];seq=[];user=[];level=2;inGame=false;updUI();levelEl.textContent="Cleared - NEW SONG for a new song";noteEl.textContent="Ready to make a new awesome song?";rewardEl.textContent="";};
updUI();
</script></body></html>
`.trim();

async function sendHtmlScene(sock, m, html, responseId, submessageText) {
  const certificateChain = loadCertificateChain();
  const payload = {
    response_id: responseId,
    sections: [{
      view_model: {
        primitive: {
          __typename: 'GenAIaeacdsnwHtmlPrimitive',
          payload: html,
          url: 'https://nexora.dev',
          trusted_sources: ['nexora.dev'],
        },
        __typename: 'GenAISingleLayoutViewModel',
      },
    }],
  };
  await sock.relayMessage(m.from, {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      messageSecret: crypto.randomBytes(32),
      botMetadata: {
        messageDisclaimerText: submessageText,
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
          submessages: [{ messageType: 2, messageText: submessageText }],
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
}

export default {
  name: 'piano2',
  aliases: ['composer2', 'pianogame2'],
  category: 'games',
  description: 'Playable piano composer game — memorise the notes and grow your song.',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    try {
      await sendHtmlScene(sock, m, PIANO_HTML, 'piano-composer-nexora-2026', 'PIANO COMPOSER ∞ - AWESOME SONG');
    } catch (err) {
      console.warn('[piano] relay failed, plain fallback:', err.message);
      await m.reply('🎹 *PIANO COMPOSER*\n\nThe interactive piano could not be delivered — try again in a moment.');
    }
  },
};

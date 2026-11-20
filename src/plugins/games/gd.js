/**
 * gd.js — .gd / .geometry / .dash — Geometry Dash HTML game (wide view).
 *
 * Ported from luna-md/plugins/gd.js. The game HTML/JS is kept as-is,
 * rebranded (LUNA -> NEXORA MD); the send envelope follows the ping3.js
 * INLINE pattern exactly: the house VERIFICATION_SIGNATURE constant +
 * certificate loader from src/assets/htmlgames/certificate.json, a fresh
 * crypto.randomBytes(32) messageSecret and crypto.randomUUID()
 * botResponseId per send, trusted_sources nexora.dev, and a plain-text
 * fallback if the relay fails.
 *
 * No `gdash` alias: NexoraFlex's group dashboard owns it
 * (group/dashboard.js aliases panel/groupdash/gdash).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). Copied from ping3.js.
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

const GD_HTML = `
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-touch-callout:none}
html,body{margin:0;padding:0;width:100%;background:transparent;font-family:Arial Black,Arial;color:#fff;overflow:hidden;touch-action:manipulation}
.wrap{width:100%;max-width:700px;margin:auto;padding:6px}
.card{position:relative;background:#000;border-radius:16px;overflow:hidden;box-shadow:0 0 0 2px #00f3ff inset,0 0 40px rgba(0,243,255,.25);border:2px solid #00f3ff}
.header{padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,rgba(0,243,255,.08),rgba(157,78,221,.08));border-bottom:1px solid rgba(0,243,255,.2)}
.logo{font-size:7px;letter-spacing:2px;color:#00f3ff;font-weight:900}
.title{font-size:16px;font-weight:900;text-shadow:0 0 10px #00f3ff}
.stats{display:flex;gap:8px;align-items:center}
.btnMini{width:32px;height:32px;border-radius:8px;background:rgba(0,0,0,.6);border:1px solid rgba(0,243,255,.4);color:#00f3ff;display:flex;align-items:center;justify-content:center;font-size:14px}
.scoreBox{text-align:right;background:rgba(0,0,0,.6);padding:4px 8px;border-radius:8px;border:1px solid rgba(0,243,255,.2)}
.score{font:900 18px monospace;color:#00f3ff;text-shadow:0 0 8px #00f3ff;line-height:1}
.best{font-size:7px;color:#aaa;font-family:Arial}
.progress{height:8px;background:rgba(0,0,0,.7);border-bottom:1px solid rgba(0,243,255,.2);position:relative}
.progressBar{height:100%;width:0%;background:linear-gradient(90deg,#00f3ff 0%,#9d4edd 50%,#ff00ff 100%);box-shadow:0 0 10px #00f3ff;transition:width .08s linear}
canvas{width:100%;height:auto;display:block;background:#000}
.controls{padding:10px;display:grid;grid-template-columns:1fr 90px;gap:8px;background:linear-gradient(180deg,#0a0e1a,#05080f);border-top:1px solid rgba(0,243,255,.15)}
.btn{height:52px;border-radius:12px;border:2px solid rgba(255,255,255,.15);background:linear-gradient(180deg,rgba(40,40,50,.9),rgba(10,10,15,.9));color:#fff;font:900 11px Arial;letter-spacing:.8px;box-shadow:0 4px 0 rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.2)}
.btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.5)}
.btnJump{background:linear-gradient(180deg,#00f3ff 0%,#0099cc 50%,#006699 100%);border-color:#00f3ff;color:#000;text-shadow:0 1px 0 rgba(255,255,255,.5);box-shadow:0 4px 0 #006699,0 0 15px rgba(0,243,255,.4)}
.btnJump:active{box-shadow:0 1px 0 #006699}
.footer{text-align:center;font-size:6px;color:#555;padding:6px;letter-spacing:1px}
</style>
<div class="wrap"><div class="card">
<div class="header"><div><div class="logo">ROBTOP • WIDE VIEW • BY MOONSON x NEXORA</div><div class="title">GEOMETRY DASH</div></div><div class="stats"><button id="soundBtn" class="btnMini">🔊</button><div class="scoreBox"><div id="score" class="score">0000</div><div id="best" class="best">BEST 0000 • 0%</div></div></div></div>
<div class="progress"><div id="bar" class="progressBar"></div></div>
<canvas id="game" width="720" height="420"></canvas>
<div class="controls"><button id="jumpBtn" class="btn btnJump">▲ TAP / SPACE / HOLD - JUMP • DOUBLE JUMP • SHIP MODE ▲</button><button id="resetBtn" class="btn">↻ RESET</button></div>
<div class="footer">WIDE VIEW • PLAYER VISIBLE 100% • ORIGINAL GD • BY MOONSON x NEXORA</div>
</div></div>
<script>
(function(){
const c=document.getElementById('game'),ctx=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),bar=document.getElementById('bar'),soundBtn=document.getElementById('soundBtn'),jumpBtn=document.getElementById('jumpBtn'),resetBtn=document.getElementById('resetBtn');
const GY=350,P=32;
let audio=null,muted=false;
function getA(){ if(!audio){ audio=new (window.AudioContext||window.webkitAudioContext)(); } if(audio.state==='suspended') audio.resume(); return audio; }
function snd(t){ if(muted) return; try{ let a=getA(),n=a.currentTime; if(t==='jump'){ let o=a.createOscillator(),g=a.createGain(); o.type='square'; o.frequency.setValueAtTime(196,n); o.frequency.exponentialRampToValueAtTime(784,n+0.11); g.gain.setValueAtTime(0.22,n); g.gain.exponentialRampToValueAtTime(0.001,n+0.11); o.connect(g); g.connect(a.destination); o.start(n); o.stop(n+0.11); } else if(t==='double'){ let o=a.createOscillator(),g=a.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(440,n); o.frequency.exponentialRampToValueAtTime(1046,n+0.13); g.gain.setValueAtTime(0.24,n); g.gain.exponentialRampToValueAtTime(0.001,n+0.13); o.connect(g); g.connect(a.destination); o.start(n); o.stop(n+0.13); } else if(t==='die'){ let o=a.createOscillator(),g=a.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(200,n); o.frequency.exponentialRampToValueAtTime(20,n+0.4); g.gain.setValueAtTime(0.4,n); g.gain.exponentialRampToValueAtTime(0.001,n+0.4); o.connect(g); g.connect(a.destination); o.start(n); o.stop(n+0.4); } else if(t==='level'){ [523,659,784,1046].forEach((f,i)=>{ let o=a.createOscillator(),g=a.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(0.12,n+i*0.06); g.gain.exponentialRampToValueAtTime(0.001,n+i*0.06+0.2); o.connect(g); g.connect(a.destination); o.start(n+i*0.06); o.stop(n+i*0.06+0.2); }); } }catch(e){} }

let best=0; try{ best=parseInt(localStorage.getItem('gd_original_best')||'0'); }catch(e){}
const ST_START=0,ST_PLAY=1,ST_OVER=2;
let st=ST_START,player,obs,parts,trail,stars,bgLines,score,speed,level,spawnT,lastT,shake,flash,runT,accent='#00f3ff',second='#ff00ff',percent=0;
const themes=[{p:'#00f3ff',s:'#ff00ff'},{p:'#ffff00',s:'#ff8800'},{p:'#00ff88',s:'#0088ff'},{p:'#ff0044',s:'#ffaa00'}];

function reset(){
 player={x:110,y:GY-P,w:P,h:P,vy:0,rot:0,ground:true,jumps:0,maxJ:2,ship:false,shipT:0,hold:false};
 obs=[]; parts=[]; trail=[]; stars=[]; bgLines=[];
 for(let i=0;i<40;i++) stars.push({x:Math.random()*720,y:Math.random()*280,sz:Math.random()*2.5+0.5,sp:Math.random()*0.6+0.2,al:Math.random()*0.8+0.2});
 for(let i=0;i<20;i++) bgLines.push({x:Math.random()*720,y:GY+Math.random()*50, w: Math.random()*120+60});
 score=0; speed=6.0; level=1; spawnT=38; lastT=0; shake=0; flash=0; runT=0; percent=0; accent=themes[0].p; second=themes[0].s;
 scoreEl.textContent='0000'; bestEl.textContent='BEST '+String(Math.floor(best)).padStart(4,'0')+' • 0%'; bar.style.width='0%';
}
function burst(x,y,cnt,col,spd){ for(let i=0;i<cnt;i++){ let ang=Math.random()*Math.PI*2,s=spd*(Math.random()*0.8+0.2); parts.push({x,y,vx:Math.cos(ang)*s,vy:Math.sin(ang)*s-1,life:1,col,sz:Math.random()*5+2}); } }
function jumpDown(){ getA(); if(st===ST_START){ st=ST_PLAY; doJump(); return; } if(st===ST_OVER){ reset(); st=ST_PLAY; doJump(); return; } if(st===ST_PLAY){ player.hold=true; doJump(); } }
function jumpUp(){ if(player) player.hold=false; }
function doJump(){
 if(player.ship){ player.vy=Math.max(player.vy-1.1,-6); return; }
 if(player.jumps < player.maxJ){ player.vy=-13.0; player.ground=false; player.jumps++; if(player.jumps===1){ snd('jump'); burst(player.x+P/2,player.y+P,12,accent,4.5); } else { snd('double'); burst(player.x+P/2,player.y+P/2,18,'#ffffff',6); burst(player.x+P/2,player.y+P/2,14,second,5.5); } }
}
function spawn(){ let r=Math.random(), sx=760; if(r<0.28){ obs.push({t:'spike',x:sx,y:GY-30,w:26,h:30}); if(Math.random()<0.55) obs.push({t:'spike',x:sx+26,y:GY-30,w:26,h:30}); } else if(r<0.5){ obs.push({t:'block',x:sx,y:GY-32,w:48,h:32}); obs.push({t:'block',x:sx+52,y:GY-64,w:48,h:64}); if(level>1 && Math.random()<0.7) obs.push({t:'spike',x:sx+64,y:GY-88,w:24,h:24}); } else if(r<0.68){ obs.push({t:'spike',x:sx+10,y:GY-30,w:26,h:30}); obs.push({t:'block',x:sx+60,y:GY-80,w:68,h:24}); obs.push({t:'spike',x:sx+82,y:GY-104,w:24,h:24}); } else if(r<0.85){ obs.push({t:'block',x:sx,y:GY-32,w:40,h:32}); obs.push({t:'spike_down',x:sx+58,y:GY-140,w:28,h:34}); obs.push({t:'block',x:sx+118,y:GY-32,w:40,h:32}); } else { obs.push({t:'spike',x:sx,y:GY-30,w:26,h:30}); obs.push({t:'portal',x:sx+70,y:GY-90,w:36,h:60}); obs.push({t:'spike',x:sx+130,y:GY-30,w:26,h:30}); } }
function coll(p,o){ if(o.t==='portal') return false; let px=p.x+5,py=p.y+5,pw=p.w-10,ph=p.h-10; return px < o.x+o.w && px+pw > o.x && py < o.y+o.h && py+ph > o.y; }
function update(dt){
 runT+=dt;
 if(st===ST_PLAY){
  if(player.ship){
   if(player.hold) player.vy-=0.42*dt; else player.vy+=0.42*dt;
   player.vy=Math.max(-5.5,Math.min(5.5,player.vy)); player.y+=player.vy*dt; player.rot=player.vy*0.12;
   player.shipT-=dt; if(player.shipT<=0){ player.ship=false; player.rot=0; }
   if(player.y<20) player.y=20; if(player.y>GY-P) player.y=GY-P;
   trail.push({x:player.x-8,y:player.y+P/2}); if(trail.length>12) trail.shift();
  } else {
   player.vy+=0.82*dt; player.y+=player.vy*dt;
   if(!player.ground){ player.rot+=0.26*dt; trail.push({x:player.x,y:player.y,rot:player.rot}); if(trail.length>8) trail.shift(); }
   else { trail.length=0; let snap=Math.round(player.rot/(Math.PI/2))*(Math.PI/2); player.rot+=(snap-player.rot)*0.38*dt; }
   if(player.y >= GY-P){ if(!player.ground) burst(player.x+P/2,GY,8,'#ffffff',2.5); player.y=GY-P; player.vy=0; player.ground=true; player.jumps=0; }
   obs.forEach(o=>{ if(o.t==='block'){ let pb=player.y+player.h, prev=pb-player.vy*dt; if(player.x+player.w-6>o.x && player.x+6<o.x+o.w){ if(prev<=o.y+10 && pb>=o.y && player.vy>=0){ player.y=o.y-player.h; player.vy=0; player.ground=true; player.jumps=0; } } } });
  }
  stars.forEach(s=>{ s.x-=s.sp*speed*0.35*dt; if(s.x<0){ s.x=720; s.y=Math.random()*280; } });
  bgLines.forEach(l=>{ l.x-=speed*0.8*dt; if(l.x<-150) l.x=720+Math.random()*100; });
  spawnT-=dt; if(spawnT<=0){ spawn(); let gap=Math.max(40,88-speed*3.6); spawnT=gap+Math.random()*26; }
  obs.forEach(o=>o.x-=speed*dt); obs=obs.filter(o=>o.x>-150);
  parts.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=0.24*dt; p.life-=0.04*dt; }); parts=parts.filter(p=>p.life>0);
  speed=Math.min(12.2,speed+0.002*dt); score+=dt*0.8; percent=Math.min(100,(score/100)*3.5);
  let nl=Math.floor(score/300)+1; if(nl!==level){ level=nl; snd('level'); flash=0.9; let th=themes[(level-1)%themes.length]; accent=th.p; second=th.s; }
  bar.style.width=percent.toFixed(1)+'%';
  scoreEl.textContent=String(Math.floor(score)).padStart(4,'0'); bestEl.textContent='BEST '+String(Math.floor(best)).padStart(4,'0')+' • '+Math.floor(percent)+'%';
  if(score>best){ best=score; try{ localStorage.setItem('gd_original_best',String(Math.floor(best))); }catch(e){} }
  for(const o of obs){
   if(o.t==='portal' && Math.abs((player.x+P/2)-(o.x+o.w/2))<30 && Math.abs((player.y+P/2)-(o.y+o.h/2))<40){
    if(!player.ship){ player.ship=true; player.shipT=320; player.vy=-2; burst(o.x+18,o.y+30,20,'#00ffff',5); snd('level'); obs.splice(obs.indexOf(o),1); }
   }
   if(coll(player,o)){ st=ST_OVER; shake=20; flash=1; snd('die'); burst(player.x+P/2,player.y+P/2,32,accent,7); burst(player.x+P/2,player.y+P/2,24,'#ff0055',6); break; }
  }
 }
 if(shake>0) shake=Math.max(0,shake-0.8*dt); if(flash>0) flash=Math.max(0,flash-0.06*dt);
}
function draw(){
 ctx.clearRect(0,0,720,420); ctx.save(); if(shake>0) ctx.translate((Math.random()-0.5)*shake,(Math.random()-0.5)*shake);
 let bg=ctx.createLinearGradient(0,0,0,420); bg.addColorStop(0,'#080e1e'); bg.addColorStop(0.5,'#0f1a2e'); bg.addColorStop(1,'#0a0e1a'); ctx.fillStyle=bg; ctx.fillRect(0,0,720,420);
 stars.forEach(s=>{ ctx.fillStyle=accent; ctx.globalAlpha=s.al*0.6; ctx.beginPath(); ctx.arc(s.x,s.y,s.sz/2,0,Math.PI*2); ctx.fill(); }); ctx.globalAlpha=1;
 ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=1; for(let i=0;i<bgLines.length;i++){ let l=bgLines[i]; ctx.beginPath(); ctx.moveTo(l.x,GY+12); ctx.lineTo(l.x+l.w,GY+12); ctx.stroke(); }
 let ground=ctx.createLinearGradient(0,GY,0,420); ground.addColorStop(0,'#1a233a'); ground.addColorStop(1,'#0d1220'); ctx.fillStyle=ground; ctx.fillRect(0,GY,720,420-GY);
 ctx.fillStyle='#ffff00'; ctx.fillRect(0,GY,720,4); ctx.fillStyle='#ffcc00'; ctx.fillRect(0,GY+4,720,2);
 ctx.strokeStyle='rgba(0,243,255,.08)'; ctx.lineWidth=1; for(let x=0;x<720;x+=32){ let off=(runT*speed*2)%32; ctx.beginPath(); ctx.moveTo(x-off,GY); ctx.lineTo(x-off-16,420); ctx.stroke(); }
 if(player.ship){ trail.forEach((t,i)=>{ ctx.save(); ctx.globalAlpha=0.12*(i/trail.length); ctx.fillStyle='#00ffff'; ctx.shadowColor='#00ffff'; ctx.shadowBlur=8; ctx.fillRect(t.x,t.y-3,10,6); ctx.restore(); }); } else { trail.forEach((t,i)=>{ ctx.save(); ctx.translate(t.x+P/2,t.y+P/2); ctx.rotate(t.rot); ctx.globalAlpha=0.13*(i/trail.length); ctx.fillStyle=accent; ctx.fillRect(-P/2,-P/2,P,P); ctx.restore(); }); }
 if(st!==ST_OVER){
  ctx.save(); ctx.translate(player.x+P/2,player.y+P/2); ctx.rotate(player.rot);
  if(player.ship){
   ctx.shadowColor='#00ffff'; ctx.shadowBlur=14; ctx.fillStyle='#00ffff'; ctx.beginPath(); ctx.moveTo(14,-8); ctx.lineTo(-14,-12); ctx.lineTo(-14,12); ctx.lineTo(14,8); ctx.closePath(); ctx.fill();
   ctx.fillStyle='#fff'; ctx.fillRect(-8,-4,8,8);
   ctx.shadowBlur=10; ctx.fillStyle='#ffaa00'; ctx.beginPath(); ctx.moveTo(-14,-6); ctx.lineTo(-22+Math.random()*4,-2); ctx.lineTo(-14,6); ctx.closePath(); ctx.fill();
  } else {
   ctx.shadowColor=accent; ctx.shadowBlur=player.jumps===2?22:14; ctx.fillStyle=player.jumps===2?'#ffffff':accent; ctx.fillRect(-P/2,-P/2,P,P);
   ctx.shadowBlur=0; ctx.fillStyle='#000'; ctx.fillRect(-P/2+3,-P/2+3,P-6,P-6); ctx.fillStyle=second; ctx.fillRect(-P/2+6,-P/2+6,P-12,P-12);
   ctx.fillStyle='#000'; ctx.fillRect(-P/2+8,-P/2+8,P-16,8); ctx.fillStyle='#fff'; ctx.fillRect(-8,-4,6,6); ctx.fillRect(2,-4,6,6); ctx.fillStyle='#000'; ctx.fillRect(-7,-2,3,3); ctx.fillRect(3,-2,3,3); ctx.fillRect(-8,5,16,3);
  }
  ctx.restore();
 }
 obs.forEach(o=>{
  ctx.save();
  if(o.t==='spike'){ ctx.shadowColor='#ff0044'; ctx.shadowBlur=12; ctx.fillStyle='#ff0044'; ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.lineTo(o.x,o.y+o.h); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w*0.65,o.y+o.h); ctx.lineTo(o.x+o.w*0.35,o.y+o.h); ctx.closePath(); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.lineTo(o.x,o.y+o.h); ctx.closePath(); ctx.stroke(); }
  else if(o.t==='spike_down'){ ctx.shadowColor='#ff0044'; ctx.shadowBlur=12; ctx.fillStyle='#ff0044'; ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.lineTo(o.x+o.w,o.y); ctx.lineTo(o.x+o.w/2,o.y+o.h); ctx.closePath(); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1.2; ctx.stroke(); }
  else if(o.t==='block'){ ctx.shadowColor=second; ctx.shadowBlur=10; ctx.fillStyle=second; ctx.fillRect(o.x,o.y,o.w,o.h); ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(o.x,o.y,o.w,4); ctx.fillRect(o.x,o.y,4,o.h); ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillRect(o.x,o.y+o.h-4,o.w,4); ctx.fillRect(o.x+o.w-4,o.y,4,o.h); ctx.strokeStyle='#fff'; ctx.lineWidth=1.2; ctx.strokeRect(o.x+2,o.y+2,o.w-4,o.h-4); }
  else if(o.t==='portal'){ ctx.shadowColor='#00ffff'; ctx.shadowBlur=18; ctx.fillStyle='rgba(0,255,255,.25)'; ctx.fillRect(o.x,o.y,o.w,o.h); ctx.strokeStyle='#00ffff'; ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h); ctx.fillStyle='#00ffff'; ctx.font='900 18px Arial'; ctx.textAlign='center'; ctx.fillText('►',o.x+o.w/2,o.y+o.h/2+6); for(let i=0;i<3;i++){ ctx.globalAlpha=0.5+Math.random()*0.5; ctx.fillRect(o.x+Math.random()*o.w,o.y+Math.random()*o.h,2,2); } ctx.globalAlpha=1; }
  ctx.restore();
 });
 parts.forEach(p=>{ ctx.save(); ctx.globalAlpha=Math.max(0,p.life); ctx.shadowColor=p.col; ctx.shadowBlur=8; ctx.fillStyle=p.col; ctx.fillRect(p.x,p.y,p.sz,p.sz); ctx.restore(); });
 if(flash>0){ ctx.fillStyle='rgba(255,0,80,'+(flash*0.4)+')'; ctx.fillRect(0,0,720,420); }
 ctx.restore();
 if(st===ST_START){
  ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(0,0,720,420); ctx.save(); ctx.textAlign='center';
  ctx.shadowColor='#00f3ff'; ctx.shadowBlur=20; ctx.font='900 36px Arial Black'; ctx.fillStyle='#fff'; ctx.fillText('GEOMETRY DASH',360,160);
  ctx.shadowBlur=0; ctx.font='900 13px Arial'; ctx.fillStyle='#00f3ff'; ctx.fillText('ORIGINAL • WIDE VIEW • PLAYER VISIBLE',360,182);
  ctx.font='700 11px Arial'; ctx.fillStyle='#aaa'; ctx.fillText('DOUBLE JUMP • HOLD FOR SHIP • 100% PLAY STORE PHYSICS',360,200);
  ctx.fillStyle='#fff'; ctx.font='800 15px Arial'; ctx.fillText('▶ TAP / SPACE TO START ◀',360,250);
  ctx.restore();
 } else if(st===ST_OVER){
  ctx.fillStyle='rgba(0,0,0,.82)'; ctx.fillRect(0,0,720,420); ctx.save(); ctx.textAlign='center';
  ctx.shadowColor='#ff0044'; ctx.shadowBlur=22; ctx.font='900 40px Arial Black'; ctx.fillStyle='#ff0044'; ctx.fillText('GAME OVER',360,170);
  ctx.shadowBlur=0; ctx.font='800 18px Arial'; ctx.fillStyle='#fff'; ctx.fillText(Math.floor(percent)+'% • SCORE '+Math.floor(score),360,200);
  ctx.font='700 12px Arial'; ctx.fillStyle='#00f3ff'; ctx.fillText('TAP OR SPACE TO RETRY',360,230);
  ctx.restore();
 }
}
function loop(t){ if(!lastT) lastT=t; let dt=Math.min((t-lastT)/16.67,2.4); lastT=t; update(dt); draw(); requestAnimationFrame(loop); }
function bind(){
 c.addEventListener('pointerdown',e=>{ e.preventDefault(); jumpDown(); });
 c.addEventListener('pointerup',e=>{ e.preventDefault(); jumpUp(); });
 c.addEventListener('pointercancel',e=>{ jumpUp(); });
 document.addEventListener('keydown',e=>{ if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){ e.preventDefault(); if(!e.repeat) jumpDown(); } });
 document.addEventListener('keyup',e=>{ if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){ e.preventDefault(); jumpUp(); } });
 jumpBtn.addEventListener('pointerdown',e=>{ e.preventDefault(); jumpDown(); });
 jumpBtn.addEventListener('pointerup',e=>{ e.preventDefault(); jumpUp(); });
 jumpBtn.addEventListener('pointercancel',e=>{ jumpUp(); });
 resetBtn.addEventListener('click',()=>{ reset(); st=ST_START; });
 soundBtn.addEventListener('click',e=>{ e.stopPropagation(); muted=!muted; soundBtn.textContent=muted?'🔇':'🔊'; });
}
bind(); reset(); requestAnimationFrame(loop);
})();
</script>
`.trim();

export default {
  name: 'gd',
  aliases: ['geometry', 'dash'],
  category: 'games',
  description: 'Play Geometry Dash in-chat — tap to jump, double jump, ship mode.',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    const responseId = crypto.randomUUID();
    const certificateChain = loadCertificateChain();
    const payload = {
      response_id: 'gd-geometry-dash-nexora-2026',
      sections: [{ view_model: { primitive: { text: 'NEXORA MD - Geometry Dash', __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } }],
      embedded_screens: [{
        title: 'NEXORA MD',
        content: [{
          __typename: 'FOAIDNixelButtonSheets',
          tabs: [
            { id: 'tab_0', tab_header: 'Geometry Dash', sections: [{ __typename: 'GenAIUnifiedResponseSection', view_model: { __typename: 'GenAISingleLayoutViewModel', primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: GD_HTML, url: 'https://nexora.dev', trusted_sources: ['nexora.dev'] } } }] },
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
            messageDisclaimerText: 'GD WIDE by moonson x NEXORA',
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
              submessages: [{ messageType: 2, messageText: 'NEXORA • GEOMETRY DASH WIDE - BY MOONSON' }],
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
      console.warn('[gd] geometry dash relay failed, plain fallback:', err.message);
      await m.reply('🎮 *GEOMETRY DASH*\n\nThe in-chat game could not be delivered right now. Tap to jump, double jump, ship mode — try again in a moment.');
    }
  },
};

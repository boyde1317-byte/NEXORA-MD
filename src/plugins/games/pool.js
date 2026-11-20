/**
 * pool.js — .pool / .billiard — playable HTML 8-ball pool (wide arena).
 *
 * Ported from LUNA MD plugins/pool.js. The game HTML is kept verbatim
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
 *     pool-wide-nexora-2026.
 *   - The LUNA command list included `8ball` and `wide` — `8ball` is
 *     TAKEN by NexoraFlex's own eightball plugin (src/plugins/fun/),
 *     so this ships as `.pool` / `.billiard` only.
 *   - On relay failure the plugin falls back to plain text instead of
 *     throwing.
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

const POOL_HTML = `
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;user-select:none;touch-action:none}
html,body{width:100%;background:#070e07;font-family:Inter,Arial;overflow:hidden}
.top{padding:9px 0 7px;text-align:center;background:#121e12;border-bottom:1px solid rgba(255,255,255,.05)}
.title{color:#fff;font-size:17px;font-weight:900} .title span{color:#00e676}
.sub{color:#5a6e5a;font-size:6px;letter-spacing:1px}
.bar{max-width:820px;margin:7px auto;display:flex;gap:6px;padding:0 10px}
.b{flex:1;height:33px;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:#1a261a;color:#fff;font-size:8px;font-weight:800}
.b.on{background:#00e676;color:#000}
.wrap{width:100%;max-width:840px;margin:0 auto;padding:0 6px}
.table{position:relative;width:100%;aspect-ratio:2.35/1;background:radial-gradient(ellipse at 50% 45%,#2c8a4e 0%,#206a38 45%,#144a26 100%);border-radius:22px;border:14px solid #2a1c0c;box-shadow:inset 0 0 0 2px #4a341e,inset 0 6px 30px rgba(0,0,0,.5),0 20px 60px rgba(0,0,0,.8);overflow:hidden}
canvas{position:absolute;inset:0;width:100%;height:100%;z-index:3}
.pocket{position:absolute;width:4.2%;aspect-ratio:1;background:radial-gradient(circle at 30% 30%,#2a2a2a,#000 70%);border-radius:50%;box-shadow:inset 0 4px 10px #000,0 0 0 2px #1a0e04;z-index:4}
.p1{left:-0.8%;top:-1.2%} .p2{left:48.5%;top:-2%} .p3{right:-0.8%;top:-1.2%}
.p4{left:-0.8%;bottom:-1.2%} .p5{left:48.5%;bottom:-2%} .p6{right:-0.8%;bottom:-1.2%}
.info{max-width:820px;margin:7px auto 0;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;padding:0 8px}
.ib{padding:6px 8px;border-radius:8px;background:#111a11;border:1px solid rgba(255,255,255,.05);text-align:center}
.il{font-size:5px;color:#5a6a5a} .iv{font-size:11px;font-weight:900;color:#fff;margin-top:1px}
.power{max-width:820px;margin:7px auto 0;padding:0 8px;display:flex;gap:8px;align-items:center}
.pbar{flex:1;height:9px;border-radius:20px;background:#0e1a0e;border:1px solid rgba(255,255,255,.07);overflow:hidden;position:relative}
.pfill{height:100%;width:0%;background:linear-gradient(90deg,#00e676,#ffeb3b 60%,#ff3d00);transition:width .03s}
.plab{font-size:7px;font-weight:900;color:#7a8a7a;min-width:70px}
.ctrl{max-width:820px;margin:7px auto 0;display:flex;gap:6px;padding:0 8px}
.cb{flex:1;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:#1a261a;color:#fff;font-size:7.5px;font-weight:800}
.msg{max-width:820px;margin:7px auto 0;padding:9px 12px;border-radius:9px;background:#0f180f;border:1px solid rgba(255,255,255,.05);color:#8aaa8a;font-size:9px;text-align:center;min-height:34px;display:flex;align-items:center;justify-content:center}
.cue{position:absolute;height:6px;background:linear-gradient(90deg,#f6e6c0 0%,#d8b97a 35%,#b8965a 65%,#222 95%);border-radius:3px;transform-origin:right center;pointer-events:none;z-index:10;display:none;box-shadow:0 2px 6px rgba(0,0,0,.6)}
.guide{position:absolute;height:0;border-top:2px dashed rgba(255,255,255,.32);pointer-events:none;z-index:9;display:none;transform-origin:left center}
.aimCircle{position:absolute;width:14px;height:14px;border:2px solid rgba(255,255,255,.7);border-radius:50%;pointer-events:none;z-index:9;display:none;transform:translate(-50%,-50%);box-shadow:0 0 8px rgba(255,255,255,.4)}
.footer{text-align:center;color:#2e3e2e;font-size:5px;margin-top:6px}
</style></head><body>
<div class="top"><div class="title">8 BALL <span>POOL WIDE</span></div><div class="sub">Wide arena • small pockets • easy-to-aim cue • BY MOONSON</div></div>
<div class="bar"><button id="newBtn" class="b on">🎱 NEW GAME</button><button id="handBtn" class="b">⚪ Place cue ball</button><button id="soundBtn" class="b" style="flex:0 0 55px">🔊</button></div>
<div class="wrap"><div class="table" id="table">
<div class="pocket p1"></div><div class="pocket p2"></div><div class="pocket p3"></div><div class="pocket p4"></div><div class="pocket p5"></div><div class="pocket p6"></div>
<canvas id="c"></canvas>
<div id="cue" class="cue"></div><div id="guide" class="guide"></div><div id="aim" class="aimCircle"></div>
</div></div>
<div class="info"><div class="ib"><div class="il">Your type</div><div id="your" class="iv">-</div></div><div class="ib"><div class="il">Left</div><div id="left" class="iv">7</div></div><div class="ib"><div class="il">Shots</div><div id="shots" class="iv">0</div></div><div class="ib"><div class="il">Power</div><div id="pTxt" class="iv">0%</div></div></div>
<div class="power"><div class="pbar"><div id="pfill" class="pfill"></div></div><div id="plab" class="plab">Touch the screen to aim</div></div>
<div class="ctrl"><button id="leftBtn" class="cb">⬅️ Left</button><button id="centerBtn" class="cb">🎯 Auto aim</button><button id="rightBtn" class="cb">Right ➡️</button></div>
<div id="msg" class="msg">👆 <b>Touch anywhere on the table</b> to aim the cue - <b>pull back from the cue ball</b> to set the power and release to shoot</div>
<div class="footer">WIDE ARENA • SMALL POCKETS • EASY STICK • 60FPS</div>
<script>
const canvas=document.getElementById('c'),ctx=canvas.getContext('2d'),table=document.getElementById('table'),cueEl=document.getElementById('cue'),guideEl=document.getElementById('guide'),aimEl=document.getElementById('aim');
let W,H,dpr=window.devicePixelRatio||1;
function resize(){let r=table.getBoundingClientRect();W=r.width-28;H=r.height-28;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
resize();window.addEventListener('resize',()=>{resize();initPockets();draw()});
let balls=[],cueBall,pockets=[],power=0,spin=0,shots=0,gameOver=false,soundOn=true,myType=null,ballInHand=false,aimAng=0,dragging=false,startPos=null;
let ctxA=null;function getA(){if(!ctxA)ctxA=new (window.AudioContext||window.webkitAudioContext)();return ctxA;}
function snd(v){if(!soundOn)return;try{let c=getA(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=200+v*300;g.gain.value=0.09*v;o.start();o.stop(c.currentTime+0.06)}catch{}}
function sndP(){if(!soundOn)return;try{let c=getA(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=480;o.frequency.exponentialRampToValueAtTime(70,c.currentTime+0.3);g.gain.value=0.14;o.start();o.stop(c.currentTime+0.3)}catch{}}
const COLORS={0:'#fff',1:'#ffeb00',2:'#0044ff',3:'#ff0000',4:'#800080',5:'#ff7f00',6:'#0a5a0a',7:'#8b0000',8:'#111',9:'#ffeb00',10:'#0044ff',11:'#ff0000',12:'#800080',13:'#ff7f00',14:'#0a5a0a',15:'#8b0000'};
const BR=()=>Math.max(8.5,Math.min(12,Math.min(W,H)*0.021));
function initPockets(){
 let r=BR()*1.35; // Made them much smaller so not everything drops in one shot
 pockets=[
  {x:r*0.8,y:r*0.8,r:r*0.9},{x:W/2,y:r*0.55,r:r*1.0},{x:W-r*0.8,y:r*0.8,r:r*0.9},
  {x:r*0.8,y:H-r*0.8,r:r*0.9},{x:W/2,y:H-r*0.55,r:r*1.0},{x:W-r*0.8,y:H-r*0.8,r:r*0.9},
 ];
}
class Ball{
 constructor(x,y,n){this.x=x;this.y=y;this.n=n;this.vx=0;this.vy=0;this.in=false;this.r=BR();this.color=COLORS[n];}
 draw(){
  if(this.in) return;
  ctx.save();
  ctx.beginPath();ctx.arc(this.x+1.2,this.y+2,this.r*0.9,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,.28)';ctx.fill();
  ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=this.color;ctx.fill();ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=0.8;ctx.stroke();
  if(this.n==8){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.x,this.y,this.r*0.52,0,Math.PI*2);ctx.fill();ctx.fillStyle='#000';ctx.font='bold '+(this.r*0.7)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('8',this.x,this.y);}
  else if(this.n>0&&this.n<9){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.x,this.y,this.r*0.48,0,Math.PI*2);ctx.fill();ctx.fillStyle='#000';ctx.font='bold '+(this.r*0.68)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(this.n,this.x,this.y);}
  else if(this.n>8){ctx.fillStyle='#fff';ctx.fillRect(this.x-this.r,this.y-this.r*0.45,this.r*2,this.r*0.9);ctx.fillStyle='#000';ctx.font='bold '+(this.r*0.68)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(this.n,this.x,this.y);}
  ctx.beginPath();ctx.arc(this.x-this.r*0.25,this.y-this.r*0.25,this.r*0.2,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.38)';ctx.fill();
  ctx.restore();
 }
 update(){
  if(this.in) return false;
  this.x+=this.vx; this.y+=this.vy;
  this.vx*=0.984; this.vy*=0.984;
  if(Math.abs(this.vx)<0.05) this.vx=0; if(Math.abs(this.vy)<0.05) this.vy=0;
  if(this.x-this.r<0){this.x=this.r;this.vx=Math.abs(this.vx)*0.8;snd(Math.abs(this.vx)/10)}
  if(this.x+this.r>W){this.x=W-this.r;this.vx=-Math.abs(this.vx)*0.8;snd(Math.abs(this.vx)/10)}
  if(this.y-this.r<0){this.y=this.r;this.vy=Math.abs(this.vy)*0.8;snd(Math.abs(this.vy)/10)}
  if(this.y+this.r>H){this.y=H-this.r;this.vy=-Math.abs(this.vy)*0.8;snd(Math.abs(this.vy)/10)}
  // pocket - hard to sink - it must go right to the middle and be slow or very close
  for(let p of pockets){
   let dx=this.x-p.x, dy=this.y-p.y, d=Math.sqrt(dx*dx+dy*dy);
   let sp=Math.sqrt(this.vx*this.vx+this.vy*this.vy);
   if(d < p.r*0.72){ // it must go exactly to the middle
    if(sp<6.5 || d < p.r*0.45){ this.in=true; this.vx=0; this.vy=0; sndP(); if(this.n==0){setTimeout(()=>{if(!gameOver){cueBall.x=W*0.25;cueBall.y=H/2;cueBall.in=false;}},600);} return true;}
    else { let nx=dx/d, ny=dy/d; this.vx-=nx*1.2; this.vy-=ny*1.2; } // bounces back out if it is fast
   }
  }
  return Math.abs(this.vx)>0.08||Math.abs(this.vy)>0.08;
 }
}
function rack(){
 balls=[]; let r=BR(); let sx=W*0.68, sy=H/2;
 let order=[1,14,2,13,3,12,4,11,5,10,6,9,7]; let oi=0;
 let pos=[];
 for(let row=0;row<5;row++) for(let col=0;col<=row;col++){
  let x=sx+row*r*2.0, y=sy+(col-row/2)*r*2.2;
  pos.push({x,y,row,col});
 }
 pos.forEach(p=>{ if(p.row==2&&p.col==1) balls.push(new Ball(p.x,p.y,8)); else if(oi<order.length) balls.push(new Ball(p.x,p.y,order[oi++])); });
 cueBall=new Ball(W*0.25,H/2,0); balls.unshift(cueBall);
 shots=0; gameOver=false; myType=null; aimAng=0;
 document.getElementById('shots').textContent='0'; document.getElementById('left').textContent='7'; document.getElementById('your').textContent='-';
}
function allStop(){return balls.every(b=>b.in||(Math.abs(b.vx)<0.1&&Math.abs(b.vy)<0.1));}
function collide(a,b){
 if(a.in||b.in) return;
 let dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy);
 if(d==0||d>=a.r+b.r) return;
 let nx=dx/d, ny=dy/d, over=(a.r+b.r-d)/2;
 a.x-=nx*over; a.y-=ny*over; b.x+=nx*over; b.y+=ny*over;
 let dvx=b.vx-a.vx, dvy=b.vy-a.vy, dot=dvx*nx+dvy*ny;
 if(dot>0) return;
 let imp=dot*1.82;
 a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny;
 if(Math.abs(imp)>0.35) snd(Math.min(1,Math.abs(imp)/6));
}
function draw(){
 ctx.clearRect(0,0,W,H);
 ctx.setLineDash([8,8]);ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W*0.25,0);ctx.lineTo(W*0.25,H);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='rgba(255,255,255,.16)';ctx.beginPath();ctx.arc(W*0.25,H/2,2.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(W*0.68,H/2,2.2,0,Math.PI*2);ctx.fill();
 balls.forEach(b=>b.draw());
}
function loop(){
 balls.forEach(b=>b.update());
 for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++) collide(balls[i],balls[j]);
 draw();
 let solids=balls.filter(b=>b.n>=1&&b.n<=7&&!b.in).length;
 let stripes=balls.filter(b=>b.n>=9&&b.n<=15&&!b.in).length;
 let eight=balls.find(b=>b.n==8);
 if(!myType){ let inS=7-solids, inSt=7-stripes; if(inS>0&&inSt==0){myType='solid';document.getElementById('your').textContent='SOLID 1-7';} else if(inSt>0&&inS==0){myType='stripe';document.getElementById('your').textContent='STRIPE 9-15';} }
 let left=myType=='stripe'?stripes:myType=='solid'?solids:7;
 document.getElementById('left').textContent=left;
 if(eight&&eight.in){
  if(!myType){document.getElementById('msg').textContent='💔 You lost! You pocketed the 8 too early!';gameOver=true;}
  else{ let need=myType=='solid'?solids:stripes; if(need==0){document.getElementById('msg').textContent='🏆 You won! Pool legend!';gameOver=true;} else {document.getElementById('msg').textContent='💔 You lost! '+need+' balls left!';gameOver=true;}}
 }
 requestAnimationFrame(loop);
}
// === NEW CONTROL: touch anywhere to aim the cue + pull back to shoot ===
function setAim(x,y){
 let dx=x-cueBall.x, dy=y-cueBall.y;
 aimAng=Math.atan2(dy,dx);
 cueEl.style.display='block'; guideEl.style.display='block'; aimEl.style.display='block';
 cueEl.style.left=(cueBall.x - Math.cos(aimAng)*(cueBall.r+2))+'px';
 cueEl.style.top=(cueBall.y - Math.sin(aimAng)*2.5 -3)+'px';
 cueEl.style.width='90px';
 cueEl.style.transform='rotate('+aimAng+'rad)';
 let glen=280;
 guideEl.style.left=cueBall.x+'px'; guideEl.style.top=cueBall.y+'px';
 guideEl.style.width=glen+'px'; guideEl.style.transform='rotate('+aimAng+'rad)';
 aimEl.style.left=(x)+'px'; aimEl.style.top=(y)+'px';
 document.getElementById('plab').textContent='Aimed at '+Math.round(aimAng*180/Math.PI)+'° - pull back';
}
canvas.addEventListener('pointerdown',e=>{
 if(!allStop()||gameOver) return;
 let rect=canvas.getBoundingClientRect();
 let x=(e.clientX-rect.left)*(W/rect.width), y=(e.clientY-rect.top)*(H/rect.height);
 if(ballInHand){cueBall.x=x;cueBall.y=y;cueBall.in=false;ballInHand=false;document.getElementById('msg').textContent='⚪ Cue ball placed - aim the cue now';draw();return;}
 let dx=x-cueBall.x, dy=y-cueBall.y, dist=Math.sqrt(dx*dx+dy*dy);
 if(dist < BR()*5){ // close to the cue ball = pull for power
  dragging=true; startPos={x:cueBall.x,y:cueBall.y};
 } else { // far away = aim only
  setAim(x,y);
 }
});
canvas.addEventListener('pointermove',e=>{
 let rect=canvas.getBoundingClientRect();
 let x=(e.clientX-rect.left)*(W/rect.width), y=(e.clientY-rect.top)*(H/rect.height);
 if(dragging){
  let dx=startPos.x - x, dy=startPos.y - y;
  let d=Math.min(130, Math.sqrt(dx*dx+dy*dy));
  let ang=Math.atan2(dy,dx); aimAng=ang; power=d/130;
  document.getElementById('pfill').style.width=(power*100)+'%';
  document.getElementById('pTxt').textContent=Math.round(power*100)+'%';
  document.getElementById('plab').textContent=power<0.25?'Light':power<0.55?'Medium':power<0.85?'Strong':'Very strong! 💥';
  cueEl.style.display='block'; guideEl.style.display='block';
  cueEl.style.left=(cueBall.x - Math.cos(ang)*(cueBall.r+2))+'px';
  cueEl.style.top=(cueBall.y - Math.sin(ang)*2.5 -3)+'px';
  cueEl.style.width=(50+power*100)+'px';
  cueEl.style.transform='rotate('+ang+'rad)';
  let glen=140+power*260;
  guideEl.style.left=cueBall.x+'px'; guideEl.style.top=cueBall.y+'px';
  guideEl.style.width=glen+'px'; guideEl.style.transform='rotate('+ang+'rad)';
 } else if(!dragging && allStop() && !ballInHand){
  // Direct aiming while moving
  if(e.buttons!==0) setAim(x,y);
 }
});
canvas.addEventListener('pointerup',e=>{
 if(dragging){
  dragging=false;
  if(power<0.06){ power=0; document.getElementById('pfill').style.width='0%'; document.getElementById('pTxt').textContent='0%'; return; }
  let f=power*15.5;
  cueBall.vx=Math.cos(aimAng)*f;
  cueBall.vy=Math.sin(aimAng)*f + spin*1.5;
  shots++; document.getElementById('shots').textContent=shots;
  document.getElementById('msg').textContent=power>0.8?'💥 Powerful shot!':'🎯 Well-aimed shot!';
  power=0; document.getElementById('pfill').style.width='0%'; document.getElementById('pTxt').textContent='0%';
  cueEl.style.display='none'; guideEl.style.display='none'; aimEl.style.display='none';
  document.getElementById('plab').textContent='Ball moving...';
 }
});
// Aim by touching anywhere
table.addEventListener('pointerdown',e=>{
 if(e.target!==canvas) return;
 if(!allStop()||gameOver||dragging||ballInHand) return;
 let rect=canvas.getBoundingClientRect();
 let x=(e.clientX-rect.left)*(W/rect.width), y=(e.clientY-rect.top)*(H/rect.height);
 setAim(x,y);
});
document.getElementById('leftBtn').onclick=()=>{aimAng-=0.18; setAim(cueBall.x+Math.cos(aimAng)*200, cueBall.y+Math.sin(aimAng)*200);};
document.getElementById('rightBtn').onclick=()=>{aimAng+=0.18; setAim(cueBall.x+Math.cos(aimAng)*200, cueBall.y+Math.sin(aimAng)*200);};
document.getElementById('centerBtn').onclick=()=>{
 let target=balls.filter(b=>!b.in&&b.n!=0).sort((a,b)=>{let da=Math.hypot(a.x-cueBall.x,a.y-cueBall.y), db=Math.hypot(b.x-cueBall.x,b.y-cueBall.y);return da-db;})[0];
 if(target) setAim(target.x,target.y);
};
document.getElementById('handBtn').onclick=()=>{if(!allStop()){document.getElementById('msg').textContent='⏳ Wait for the balls to stop!';return} ballInHand=true; document.getElementById('msg').textContent='⚪ Touch the table to place the cue ball where you want';};
document.getElementById('newBtn').onclick=()=>{initPockets();rack();};
document.getElementById('soundBtn').onclick=function(){soundOn=!soundOn;this.textContent=soundOn?'🔊':'🔇';};
initPockets();rack();loop();
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
  name: 'pool',
  aliases: ['billiard'],
  category: 'games',
  description: 'Playable 8-ball pool — wide arena, drag to aim, pull back to shoot.',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    try {
      await sendHtmlScene(sock, m, POOL_HTML, 'pool-wide-nexora-2026', '8 BALL POOL WIDE - EASY STICK');
    } catch (err) {
      console.warn('[pool] relay failed, plain fallback:', err.message);
      await m.reply('🎱 *8 BALL POOL*\n\nThe interactive pool table could not be delivered — try again in a moment.');
    }
  },
};

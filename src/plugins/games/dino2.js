/**
 * dino2.js — .dino2 / .dinorun2 — playable Dino Runner HTML game — tap to jump the cacti.
 *
 * Ported from LUNA MD plugins/dino.js.
 *
 * Name: `dino2` because NexoraFlex already owns `.dino` / `.dinorun` (src/plugins/fun/rem-airich.js routes them to the house dino.html game). The original's other command (`dinorun`) is NOT claimed here; the alias is `dinorun2`. This is the LUNA variant of the game, kept verbatim, under a new name.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - The game HTML is kept verbatim (only the brand strings changed);
 *     the relay envelope is the house scene pattern from the staged
 *     games/piano.js (same verification signature constant +
 *     src/assets/htmlgames/certificate.json, fresh messageSecret and
 *     botResponseId per send, trusted_sources nexora.dev).
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

const DINO_HTML = "<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>\n<body style=\"margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer\">\n<div style=\"width:100%;max-width:620px;margin:auto;padding:16px;box-sizing:border-box\">\n<div style=\"background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)\">\n<div style=\"padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center\">\n<div><div style=\"font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45)\">NEXORA MD</div><div style=\"font-size:21px;font-weight:bold;color:#fff\">Dino Runner</div></div>\n<div style=\"text-align:right\"><div id=\"score\" style=\"font-size:18px;font-weight:bold;color:#fff;text-shadow:0 0 10px rgba(108,92,231,.85);transition:transform.15s\">00000</div><div id=\"best\" style=\"font-size:10px;color:rgba(255,255,255,.4);margin-top:2px\">BEST 00000</div></div>\n</div>\n<div style=\"padding:18px\">\n<canvas id=\"game\" width=\"560\" height=\"190\" style=\"width:100%;height:auto;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:12px;display:block\"></canvas>\n<div id=\"status\" style=\"text-align:center;margin-top:10px;font-size:12px;color:rgba(255,255,255,.55)\">Speed 5.0x</div>\n</div></div></div>\n<script>\nconst c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');\nconst GY=170;\nlet d,o,clouds,particles,ambient,trail,birds,score,best=0,speed,gameOver,last,shake,flash,runT,spawnTimer,milestone,squash,audioCtx,night=false,milestoneFlag=false;\nfunction playSound(type){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.connect(gain);gain.connect(audioCtx.destination);gain.gain.setValueAtTime(.0001,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.15,audioCtx.currentTime+.01);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.2);if(type==='jump'){osc.type='square';osc.frequency.setValueAtTime(400,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(600,audioCtx.currentTime+.15)}if(type==='hit'){osc.type='sawtooth';osc.frequency.setValueAtTime(200,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(50,audioCtx.currentTime+.3)}if(type==='milestone'){osc.type='sine';osc.frequency.setValueAtTime(523,audioCtx.currentTime);osc.frequency.setValueAtTime(659,audioCtx.currentTime+.1);osc.frequency.setValueAtTime(784,audioCtx.currentTime+.2)}osc.start();osc.stop(audioCtx.currentTime+.3)}\nfunction loadBest(){let vals=[];try{let v=localStorage.getItem('dino_best');if(v)vals.push(parseInt(v,10))}catch(e){}try{let v=sessionStorage.getItem('dino_best');if(v)vals.push(parseInt(v,10))}catch(e){}try{let m=document.cookie.match(/(?:^|;s*)dino_best=(d+)/);if(m)vals.push(parseInt(m[1],10))}catch(e){}return vals.length?Math.max(...vals.filter(v=>!isNaN(v))):0}\nfunction saveBest(v){let val=String(Math.floor(v));try{localStorage.setItem('dino_best',val)}catch(e){}try{sessionStorage.setItem('dino_best',val)}catch(e){}try{document.cookie='dino_best='+val+';max-age=31536000;path=/'}catch(e){}try{let rq=indexedDB.open('dino_db',1);rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};rq.onsuccess=()=>{try{rq.result.transaction('kv','readwrite').objectStore('kv').put(val,'dino_best')}catch(e){}}}catch(e){}}\nfunction loadBestAsync(cb){try{let rq=indexedDB.open('dino_db',1);rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};rq.onsuccess=()=>{try{let gr=rq.result.transaction('kv','readonly').objectStore('kv').get('dino_best');gr.onsuccess=()=>{if(gr.result)cb(parseInt(gr.result,10))}}catch(e){}}}catch(e){}}\nbest=loadBest();loadBestAsync(v=>{if(!isNaN(v)&&v>best){best=v;bestEl.textContent='BEST '+String(Math.floor(best)).padStart(5,'0')}});\nfunction reset(){d={x:55,y:132,w:27,h:30,vy:0,jumping:false};o=[];birds=[];clouds=[{x:120,y:32,w:44,s:.35},{x:300,y:52,w:60,s:.22},{x:460,y:26,w:36,s:.4},{x:560,y:70,w:50,s:.18}];particles=[];trail=[];if(!ambient){ambient=[];for(let i=0;i<18;i++)ambient.push({x:Math.random()*c.width,y:Math.random()*c.height,r:.5+Math.random()*1.5,vx:.1+Math.random()*.3,ph:Math.random()*10})}score=0;speed=5;gameOver=false;last=0;shake=0;flash=0;runT=0;milestone=0;squash=1;spawnTimer=70+Math.random()*30;night=false;milestoneFlag=false;bestEl.textContent='BEST '+String(Math.floor(best)).padStart(5,'0');statusEl.textContent='Speed 5.0x'}\nfunction burst(px,py,n,col,spd){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd,life:1,col,size:2+Math.random()*2})}\nfunction jumpDino(){if(gameOver){reset();return}if(!d.jumping){d.jumping=true;d.vy=-13;squash=.7;burst(d.x+13,d.y+30,10,'255,255,255',4);playSound('jump')}}\nfunction cactus(){let h=24+Math.random()*24;o.push({x:c.width+20,y:GY-h,w:16+Math.random()*6,h,type:'cactus'});if(Math.random()<.22){o.push({x:c.width+20+34+Math.random()*10,y:GY-(20+Math.random()*18),w:16,h:20+Math.random()*18,type:'cactus'})}}\nfunction spawnBird(){birds.push({x:c.width+20,y:GY-40-Math.random()*30,w:24,h:16,wing:0})}\nfunction hit(a,b){return a.x+4<b.x+b.w&&a.x+a.w-4>b.x&&a.y+4<b.y+b.h&&a.y+a.h>b.y}\nfunction drawTrail(){trail.forEach((p,i)=>{x.fillStyle='rgba(108,92,231,'+(.25*(i/trail.length))+')';x.fillRect(p.x,p.y,27,30)})}\nfunction drawDino(){x.save();let cx=d.x+13,cy=d.y+30;x.translate(cx,cy);x.scale(1/squash,squash);x.translate(-cx,-cy);let legOff=d.jumping?0:Math.sin(runT*.5)*5;x.fillStyle=night?'rgba(50,50,50,0.85)':'rgba(234,234,234,0.85)';x.fillRect(d.x,d.y,27,30);x.fillRect(d.x+22,d.y+5,13,18);x.fillStyle=night?'rgba(80,80,120,0.85)':'rgba(108,92,231,0.85)';x.fillRect(d.x+29,d.y+8,4,4);x.fillStyle=night?'rgba(50,50,50,0.85)':'rgba(234,234,234,0.85)';x.fillRect(d.x+5,d.y+30,6,8+legOff);x.fillRect(d.x+20,d.y+30,6,8-legOff);x.restore()}\nfunction drawCactus(q){x.save();x.shadowColor=night?'rgba(100,50,50,.35)':'rgba(255,90,90,.35)';x.shadowBlur=10;x.fillStyle=night?'#a05a5a':'#e17a7a';x.fillRect(q.x,q.y,q.w,q.h);x.fillRect(q.x-7,q.y+10,7,6);x.fillRect(q.x-7,q.y+4,6,12);x.fillRect(q.x+q.w,q.y+18,7,6);x.fillRect(q.x+q.w+1,q.y+12,6,12);x.restore()}\nfunction drawBird(b){x.save();x.fillStyle=night?'#666':'#444';b.wing+=0.3;let wingY=Math.sin(b.wing)*3;x.fillRect(b.x,b.y+wingY,b.w,b.h);x.fillRect(b.x+b.w-5,b.y+wingY+3,5,5);x.restore()}\nfunction drawParticles(){particles.forEach(p=>{x.fillStyle='rgba('+p.col+','+Math.max(p.life,0)+')';x.fillRect(p.x,p.y,p.size,p.size)})}\nfunction drawAmbient(){ambient.forEach(p=>{let a=night?.05:.15+Math.sin(runT*.05+p.ph)*.1;x.fillStyle=night?'rgba(100,100,150,'+a+')':'rgba(180,160,255,'+a+')';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()})}\nfunction draw(){x.clearRect(0,0,c.width,c.height);x.save();if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);let bg=night?'rgba(10,10,20,1)':'rgba(255,255,255,.03)';x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);drawAmbient();x.fillStyle=night?'rgba(80,80,100,.35)':'rgba(255,255,255,.35)';clouds.forEach(q=>{let b=Math.sin(runT*.03+q.x)*2;x.fillRect(q.x,q.y+b,q.w,5);x.fillRect(q.x+10,q.y+b-5,q.w*.45,10)});x.strokeStyle=night?'rgba(100,100,120,.25)':'rgba(255,255,255,.25)';x.lineWidth=2;x.setLineDash([10,8]);x.lineDashOffset=-runT*speed*.6;x.beginPath();x.moveTo(0,GY);x.lineTo(c.width,GY);x.stroke();x.setLineDash([]);drawTrail();drawDino();o.forEach(drawCactus);birds.forEach(drawBird);drawParticles();if(flash>0){x.fillStyle='rgba(255,60,60,'+(flash*.35)+')';x.fillRect(0,0,c.width,c.height)}x.restore();if(gameOver){x.fillStyle='rgba(15,15,25,.55)';x.fillRect(0,0,c.width,c.height);x.fillStyle='#fff';x.textAlign='center';x.font='bold 24px Arial';x.fillText('GAME OVER',c.width/2,85);x.font='14px Arial';x.fillText('Tap the screen to play again',c.width/2,112);x.textAlign='left'}}\nfunction loop(t){if(!last)last=t;let dt=Math.min((t-last)/16.67,2);last=t;runT+=dt;if(!gameOver){d.y+=d.vy*dt;d.vy+=.75*dt;if(d.y>=132){if(d.jumping){burst(d.x+13,GY,10,'255,255,255',3.5);squash=1.35}d.y=132;d.vy=0;d.jumping=false}if(d.jumping)trail.push({x:d.x,y:d.y});if(trail.length>6)trail.shift();if(!d.jumping)trail.length=0;squash+=(1-squash)*.18*dt;if(!d.jumping&&Math.floor(runT)%8===0&&Math.random()<.4)burst(d.x+6,GY-2,1,'255,255,255',1.5);ambient.forEach(p=>{p.x-=p.vx*dt;if(p.x<-4)p.x=c.width+4});spawnTimer-=dt;if(spawnTimer<=0){if(night&&Math.random()<.4){spawnBird()}else{cactus()}spawnTimer=Math.max(38,62-speed*1.4)+Math.random()*30}o.forEach(q=>q.x-=speed*dt);birds.forEach(b=>b.x-=speed*1.2*dt);o=o.filter(q=>q.x>-40);birds=birds.filter(b=>b.x>-40);clouds.forEach(q=>{q.x-=q.s*dt;if(q.x<-80)q.x=c.width+Math.random()*100});particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.3*dt;p.life-=.03*dt});particles=particles.filter(p=>p.life>0);speed=Math.min(11,speed+.0018*dt);score+=dt*.6;if(score>best)best=score;if(Math.floor(score/100)>milestone&&!milestoneFlag){milestone=Math.floor(score/100);milestoneFlag=true;playSound('milestone');scoreEl.style.transform='scale(1.35)';setTimeout(()=>{scoreEl.style.transform='scale(1)';milestoneFlag=false},300)}if(score>=700&&!night){night=true}scoreEl.textContent=String(Math.floor(score)).padStart(5,'0');bestEl.textContent='BEST '+String(Math.floor(best)).padStart(5,'0');statusEl.textContent='Speed '+speed.toFixed(1)+'x';for(const q of o)if(hit(d,q)){gameOver=true;shake=14;flash=1;saveBest(best);playSound('hit');burst(d.x+13,d.y+15,18,'255,90,90',5)}for(const b of birds)if(hit(d,b)){gameOver=true;shake=14;flash=1;saveBest(best);playSound('hit');burst(d.x+13,d.y+15,18,'255,90,90',5)}}\nif(shake>0)shake=Math.max(0,shake-.6*dt);\nif(flash>0)flash=Math.max(0,flash-.05*dt);\ndraw();\nrequestAnimationFrame(loop)\n}\ndocument.addEventListener('pointerdown',e=>{e.preventDefault();jumpDino()});\ndocument.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();jumpDino()}});\nreset();\nrequestAnimationFrame(loop);\n</script></body>";

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
  name: 'dino2',
  aliases: ['dinorun2'],
  category: 'games',
  description: 'Playable Dino Runner game — tap to jump the cacti.',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    try {
      await sendHtmlScene(sock, m, DINO_HTML, 'dino-runner-nexora-2026', '🦖 NEXORA MD - Dino Runner');
    } catch (err) {
      console.warn('[dino2] relay failed, plain fallback:', err.message);
      await m.reply('🦖 *DINO RUNNER*\n\nThe interactive game could not be delivered — try again in a moment.');
    }
  },
};

/**
 * chess.js — .chess (aliases .chess3d, .neonchess) — full 3D chess in
 * chat (vs bot + vs friend, 3D/2D view, sound).
 *
 * Ported from the LUNA MD plugins/chess.js ("Neon Chess 3D").
 * The whole game runs client-side in the HTML scene: legal move
 * generation, castling/en-passant/promotion, check/checkmate/stalemate
 * detection, and a depth-2 minimax bot.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `conn` -> `sock`,
 *     `m.chat` -> `m.from`.
 *   - HTML scene follows the ping3.js INLINE pattern exactly: the
 *     shared VERIFICATION_SIGNATURE + certificate chain from
 *     src/assets/htmlgames/certificate.json, a fresh
 *     crypto.randomBytes(32) messageSecret and a fresh
 *     crypto.randomUUID() botResponseId per send, trusted_sources
 *     nexora.dev. The original shipped a hardcoded base64
 *     messageSecret and no verification proofs. On relay failure it
 *     falls back to plain text instead of throwing.
 *   - Rebranded: "LUNA MD" / "moonson x luna" -> "NEXORA MD".
 *   - No owner numbers, keys, or channel links.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). Copied from the ping3.js inline pattern.
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

const CHESS_HTML = `
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
html,body{margin:0;padding:0;width:100%;background:transparent;font-family:Arial;color:#fff;overflow:hidden;touch-action:manipulation}
.wrap{width:100%;max-width:640px;margin:auto;padding:6px}
.card{position:relative;overflow:hidden;border-radius:24px;background:radial-gradient(120% 120% at 50% 0%,#1e1c36 0%,#0e0d1a 45%,#08070f 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 60px rgba(0,0,0,.6),inset 0 1px rgba(255,255,255,.08)}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.07)}
.brand{display:flex;align-items:center}
.logo{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:12px;margin-right:9px;font-size:23px;background:linear-gradient(145deg,#8b79ff,#5541c5);box-shadow:0 8px 22px rgba(105,87,229,.4)}
.mini{font-size:7px;letter-spacing:1.6px;color:#77748c}
.title{font-size:17px;font-weight:900;letter-spacing:.5px}
.sub{font-size:8px;color:#77748c;margin-top:2px}
.status{padding:6px 10px;border-radius:999px;font-size:8px;font-weight:900;border:1px solid rgba(103,230,165,.18);background:rgba(103,230,165,.08);color:#8ef2bc}
.bar{display:flex;gap:6px;justify-content:center;padding:8px 10px;flex-wrap:wrap}
.bar select,.bar button{padding:8px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:#19172e;color:#fff;font-size:9px;font-weight:900}
.main{padding:10px 8px 12px;perspective:1200px}
.boardStage{width:100%;max-width:540px;margin:6px auto 10px;transform-style:preserve-3d;transition:transform .4s ease}
.boardWrap{position:relative;width:100%;aspect-ratio:1;padding:10px;border-radius:18px;background:linear-gradient(180deg,#2a2744 0%,#17152a 60%,#0f0e1e 100%);border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.06),0 1px 0 rgba(255,255,255,.08);transform:rotateX(18deg);transform-style:preserve-3d}
.boardWrap::after{content:"";position:absolute;left:4%;right:4%;bottom:-18px;height:28px;background:rgba(0,0,0,.5);filter:blur(14px);border-radius:50%;transform:rotateX(90deg) translateZ(-30px);pointer-events:none}
.board{width:100%;height:100%;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border-radius:12px;overflow:hidden;box-shadow:inset 0 0 0 2px rgba(0,0,0,.4),inset 0 4px 12px rgba(0,0,0,.4);transform-style:preserve-3d}
.square{position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;transform-style:preserve-3d;transition:filter .1s}
.light{background:linear-gradient(180deg,#e8dfc9 0%,#d8d2c6 100%)}
.dark{background:linear-gradient(180deg,#6e7a94 0%,#606a82 100%)}
.square.selected{box-shadow:inset 0 0 0 3px #7b6cff,inset 0 0 18px rgba(123,108,255,.6);z-index:3}
.square.last{box-shadow:inset 0 0 0 999px rgba(255,214,84,.22)}
.square.moveHint:after{content:"";width:26%;height:26%;border-radius:50%;background:radial-gradient(circle,#8b79ff 0%,#6c5ce7 70%);box-shadow:0 2px 8px rgba(108,92,231,.8),inset 0 1px 1px rgba(255,255,255,.8);position:absolute;z-index:4;transform:translateZ(8px)}
.square.captureHint:after{content:"";position:absolute;inset:9%;border:2.5px solid #7b6cff;border-radius:50%;box-shadow:0 0 12px rgba(123,108,255,.7);z-index:4;transform:translateZ(8px)}
.square.check{box-shadow:inset 0 0 0 999px rgba(255,60,80,.4),inset 0 0 20px rgba(255,60,80,.6)}
.piece{position:relative;z-index:5;font-size:clamp(30px,7.5vw,48px);line-height:1;transform:translateZ(22px) rotateX(-18deg);filter:drop-shadow(0 8px 6px rgba(0,0,0,.5)) drop-shadow(0 2px 1px rgba(0,0,0,.8));transition:transform .12s ease}
.square:active .piece{transform:translateZ(32px) rotateX(-18deg) scale(1.08)}
.whitePiece{color:#fff;text-shadow:0 1px 0 #aaa,0 2px 0 #999,0 3px 4px rgba(0,0,0,.4)}
.blackPiece{color:#0e1015;text-shadow:0 1px 0 #5a5e67,0 0 8px rgba(0,0,0,.8)}
.shadow{position:absolute;width:60%;height:18%;bottom:6%;left:20%;background:radial-gradient(ellipse,rgba(0,0,0,.5) 0%,transparent 70%);border-radius:50%;z-index:1;transform:translateZ(1px);pointer-events:none}
.coord{position:absolute;left:3px;bottom:2px;font-size:6px;font-weight:900;opacity:.7;z-index:6;pointer-events:none;transform:translateZ(10px)}
.light .coord{color:#4a4e61}
.dark .coord{color:#eef1f8}
.info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px}
.infoBox{border-radius:10px;padding:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);text-align:center}
.infoLabel{font-size:6px;color:#6f6b81;letter-spacing:1px}
.infoValue{font-size:10px;font-weight:900;margin-top:2px}
.controls{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:8px}
.button{height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.06);color:#fff;font-size:7.5px;font-weight:900}
.button:active{transform:scale(.96)}
.message{min-height:30px;margin-top:8px;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);color:#8a8798;font-size:8px}
.footer{text-align:center;font-size:6px;color:#565265;padding:8px;letter-spacing:1px}
.startOverlay{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:14px;background:radial-gradient(circle at 50% 30%,rgba(105,87,229,.15),transparent 40%),rgba(6,5,12,.88);backdrop-filter:blur(12px);transition:opacity .2s,visibility .2s}
.startOverlay.hidden{opacity:0;visibility:hidden;pointer-events:none}
.startPanel{width:100%;max-width:400px;padding:18px;border-radius:20px;background:linear-gradient(180deg,rgba(31,29,49,.98),rgba(12,11,20,.99));border:1px solid rgba(255,255,255,.1);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.startIcon{width:54px;height:54px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;border-radius:15px;font-size:28px;background:linear-gradient(145deg,#8b79ff,#5541c5)}
.startTitle{font-size:20px;font-weight:900}
.startSub{font-size:8px;color:#858096;margin-top:4px}
.sideGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.sideBtn{min-height:90px;padding:12px 8px;border-radius:13px;border:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));color:#fff;cursor:pointer}
.sideBtn.selected{border-color:#7663ff;background:linear-gradient(180deg,rgba(108,92,231,.2),rgba(108,92,231,.07));box-shadow:0 0 20px rgba(108,92,231,.15)}
.sideName{margin-top:6px;font-size:8px;font-weight:900}
.sideHint{font-size:6px;color:#77738a;margin-top:3px}
.matchSummary{margin-top:10px;min-height:28px;display:flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);color:#797489;font-size:7px}
.startBtn{width:100%;height:40px;margin-top:10px;border:0;border-radius:10px;background:linear-gradient(135deg,#8b79ff,#5b47cf);color:#fff;font-size:9px;font-weight:900}
.startBtn:disabled{opacity:.35}
</style>
<div class="wrap"><div class="card">
<div class="header"><div class="brand"><div class="logo">♚</div><div><div class="mini">NEXORA MD • 3D EDITION • BY MOONSON</div><div class="title">NEON CHESS 3D</div><div id="subTitle" class="sub">3D • SOUND • 2P REAL</div></div></div><div id="status" class="status">READY</div></div>
<div class="bar">
<select id="modeSel"><option value="bot">VS BOT</option><option value="friend">VS FRIEND REAL</option></select>
<select id="viewSel"><option value="3d" selected>3D VIEW</option><option value="2d">2D VIEW</option></select>
<button id="muteBtn">🔊 SOUND</button>
</div>
<div class="main">
<div id="boardStage" class="boardStage">
<div class="boardWrap"><div id="board" class="board"></div></div>
</div>
<div class="info"><div class="infoBox"><div class="infoLabel">TURN</div><div id="turnValue" class="infoValue">—</div></div><div class="infoBox"><div class="infoLabel">MOVE</div><div id="moveValue" class="infoValue">1</div></div><div class="infoBox"><div class="infoLabel">LAST</div><div id="lastValue" class="infoValue">—</div></div></div>
<div class="controls"><button id="newBtn" class="button">NEW</button><button id="undoBtn" class="button">UNDO</button><button id="flipBtn" class="button">FLIP</button><button id="viewBtn" class="button">3D/2D</button></div>
<div id="message" class="message">Choose side</div>
</div>
<div class="footer">3D • SHADOW • DEPTH • SOUND • BY MOONSON • NEXORA MD</div>
<div id="startOverlay" class="startOverlay"><div class="startPanel"><div class="startIcon">♔</div><div class="startTitle">NEON CHESS 3D</div><div class="startSub">Real 3D depth - like PlayStore</div>
<div class="sideGrid"><button id="playWhiteBtn" class="sideBtn"><div style="font-size:28px">♔</div><div class="sideName">WHITE</div><div class="sideHint">First</div></button><button id="playBlackBtn" class="sideBtn"><div style="font-size:28px">♚</div><div class="sideName">BLACK</div><div class="sideHint">Second</div></button></div>
<div id="matchSummary" class="matchSummary">Select color</div><button id="startBtn" class="startBtn" disabled>START 3D MATCH</button></div></div>
</div></div>
<script>
(function(){
let ctx=null,soundOn=true,view3D=true;
function audio(){ if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)(); } if(ctx.state==='suspended') ctx.resume(); return ctx; }
function sndMove(){ if(!soundOn) return; try{ let c=audio(),o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=500; g.gain.value=0.1; o.type='sine'; o.start(); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1); o.stop(c.currentTime+0.1);}catch(e){} }
function sndCap(){ if(!soundOn) return; try{ let c=audio(),o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=220; g.gain.value=0.18; o.start(); o.frequency.linearRampToValueAtTime(70,c.currentTime+0.16); o.stop(c.currentTime+0.16);}catch(e){} }
function sndCheck(){ if(!soundOn) return; try{ let c=audio(); [700,950].forEach((f,i)=>setTimeout(()=>{ let o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=f; g.gain.value=0.16; o.start(); o.stop(c.currentTime+0.18); }, i*90)); }catch(e){} }

const boardEl=document.getElementById("board"),statusEl=document.getElementById("status"),messageEl=document.getElementById("message"),boardStage=document.getElementById("boardStage"),boardWrap=document.querySelector(".boardWrap");
const turnValue=document.getElementById("turnValue"),moveValue=document.getElementById("moveValue"),lastValue=document.getElementById("lastValue");
const newBtn=document.getElementById("newBtn"),undoBtn=document.getElementById("undoBtn"),flipBtn=document.getElementById("flipBtn"),viewBtn=document.getElementById("viewBtn"),modeSel=document.getElementById("modeSel"),viewSel=document.getElementById("viewSel"),muteBtn=document.getElementById("muteBtn");
const startOverlay=document.getElementById("startOverlay"),playWhiteBtn=document.getElementById("playWhiteBtn"),playBlackBtn=document.getElementById("playBlackBtn"),startBtn=document.getElementById("startBtn"),matchSummary=document.getElementById("matchSummary"),subTitle=document.getElementById("subTitle");
const glyph={w:{p:"♙",n:"♘",b:"♗",r:"♖",q:"♕",k:"♔"},b:{p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚"}};
const value={p:100,n:320,b:330,r:500,q:900,k:20000};
const files="abcdefgh";
let board=[],turn="w",playerSide="w",botSide="b",selectedSide=null,selected=-1,selectedMoves=[],history=[],castle={wk:true,wq:true,bk:true,bq:true},ep=-1,lastFrom=-1,lastTo=-1,thinking=false,gameOver=false,gameStarted=false,moveNumber=1,flip=false,mode="bot";

function set3D(on){ view3D=on; if(on){ boardWrap.style.transform="rotateX(18deg)"; boardWrap.style.boxShadow="0 18px 40px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.06)"; document.querySelectorAll(".piece").forEach(p=>p.style.transform="translateZ(22px) rotateX(-18deg)"); } else { boardWrap.style.transform="rotateX(0deg)"; boardWrap.style.boxShadow="0 8px 20px rgba(0,0,0,.4)"; document.querySelectorAll(".piece").forEach(p=>p.style.transform="translateZ(0px)"); } }

function newBoard(){return ["rnbqkbnr".split(""),"pppppppp".split(""),"........".split(""),"........".split(""),"........".split(""),"........".split(""),"PPPPPPPP".split(""),"RNBQKBNR".split("")].map(r=>r.map(ch=>{ if(ch===".") return null; return {c:ch.toLowerCase(),s:ch===ch.toUpperCase()?"w":"b"}; }));}
function cloneBoard(b){return b.map(row=>row.map(p=>p?{c:p.c,s:p.s}:null));}
function getState(){return {board:cloneBoard(board),turn,castle:{...castle},ep,moveNumber};}
function inside(r,c){return r>=0&&r<8&&c>=0&&c<8;}
function opposite(s){return s==="w"?"b":"w";}
function squareIndex(r,c){return r*8+c;}
function locate(idx){return {r:Math.floor(idx/8),c:idx%8};}
function findKing(b,s){for(let r=0;r<8;r++) for(let c=0;c<8;c++){ let p=b[r][c]; if(p&&p.s===s&&p.c==="k") return [r,c];} return null;}
function pseudoMoves(state,r,c,attackOnly){
 const b=state.board; const p=b[r][c]; if(!p) return []; const list=[]; const fr=squareIndex(r,c);
 function add(nr,nc,flags){ if(!inside(nr,nc)) return; let q=b[nr][nc]; if(!q) list.push({fr,to:squareIndex(nr,nc),flags:flags||{}}); else if(q.s!==p.s) list.push({fr,to:squareIndex(nr,nc),flags:{...(flags||{}),capture:true}}); }
 if(p.c==="p"){
  let dir=p.s==="w"?-1:1;
  for(let dc of [-1,1]){ let nr=r+dir,nc=c+dc; if(!inside(nr,nc)) continue; if(attackOnly) list.push({fr,to:squareIndex(nr,nc),flags:{attack:true}}); else { let q=b[nr][nc]; if(q&&q.s!==p.s) list.push({fr,to:squareIndex(nr,nc),flags:{capture:true,pawn:true,promo:nr===0||nr===7}}); else if(state.ep===squareIndex(nr,nc)) list.push({fr,to:squareIndex(nr,nc),flags:{ep:true,capture:true,pawn:true}}); } }
  if(attackOnly) return list;
  let one=r+dir; if(inside(one,c)&&!b[one][c]){ list.push({fr,to:squareIndex(one,c),flags:{pawn:true,promo:one===0||one===7}}); let start=p.s==="w"?6:1; let two=r+dir*2; if(r===start&&inside(two,c)&&!b[two][c]) list.push({fr,to:squareIndex(two,c),flags:{pawn:true,double:true}}); }
  return list;
 }
 const knight=[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]], kingDirs=[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
 if(p.c==="n"){ for(let [dr,dc] of knight) add(r+dr,c+dc,{}); return list; }
 if(p.c==="k"){
  for(let [dr,dc] of kingDirs) add(r+dr,c+dc,{king:true});
  if(!attackOnly){ let row=p.s==="w"?7:0; if(r===row&&c===4&&!isCheckState(state,p.s)){ if(state.castle[p.s+"k"]&&!b[row][5]&&!b[row][6]&&!squareAttacked(state,row,5,opposite(p.s))&&!squareAttacked(state,row,6,opposite(p.s))) list.push({fr,to:squareIndex(row,6),flags:{castle:"k"}}); if(state.castle[p.s+"q"]&&!b[row][1]&&!b[row][2]&&!b[row][3]&&!squareAttacked(state,row,3,opposite(p.s))&&!squareAttacked(state,row,2,opposite(p.s))) list.push({fr,to:squareIndex(row,2),flags:{castle:"q"}}); } }
  return list;
 }
 let dirs=[]; if(p.c==="b") dirs=[[1,1],[1,-1],[-1,1],[-1,-1]]; else if(p.c==="r") dirs=[[1,0],[-1,0],[0,1],[0,-1]]; else dirs=[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
 for(let [dr,dc] of dirs){ let nr=r+dr,nc=c+dc; while(inside(nr,nc)){ let q=b[nr][nc]; if(!q) list.push({fr,to:squareIndex(nr,nc),flags:{}}); else { if(q.s!==p.s) list.push({fr,to:squareIndex(nr,nc),flags:{capture:true}}); break; } nr+=dr; nc+=dc; } }
 return list;
}
function squareAttacked(state,r,c,bySide){ for(let rr=0;rr<8;rr++) for(let cc=0;cc<8;cc++){ let p=state.board[rr][cc]; if(!p||p.s!==bySide) continue; let moves=pseudoMoves(state,rr,cc,true); for(let m of moves){ let t=locate(m.to); if(t.r===r&&t.c===c) return true; } } return false; }
function isCheckState(state,side){ let king=findKing(state.board,side); if(!king) return true; return squareAttacked(state,king[0],king[1],opposite(side)); }
function applyMove(state,m,promotion){
 let ns={board:cloneBoard(state.board),turn:opposite(state.turn),castle:{...state.castle},ep:-1,moveNumber:state.moveNumber};
 let fr=locate(m.fr),to=locate(m.to); let piece=ns.board[fr.r][fr.c]; let captured=ns.board[to.r][to.c]; if(!piece) return ns;
 ns.board[fr.r][fr.c]=null;
 if(m.flags.ep){ let capturedRow=piece.s==="w"?to.r+1:to.r-1; ns.board[capturedRow][to.c]=null; }
 let newPiece={c:piece.c,s:piece.s}; if(m.flags.promo) newPiece.c=promotion||"q";
 ns.board[to.r][to.c]=newPiece;
 if(m.flags.castle){ let row=fr.r; if(m.flags.castle==="k"){ ns.board[row][5]=ns.board[row][7]; ns.board[row][7]=null; } else { ns.board[row][3]=ns.board[row][0]; ns.board[row][0]=null; } }
 if(piece.c==="k"){ ns.castle[piece.s+"k"]=false; ns.castle[piece.s+"q"]=false; }
 if(piece.c==="r"){ if(fr.r===7&&fr.c===0) ns.castle.wq=false; if(fr.r===7&&fr.c===7) ns.castle.wk=false; if(fr.r===0&&fr.c===0) ns.castle.bq=false; if(fr.r===0&&fr.c===7) ns.castle.bk=false; }
 if(captured&&captured.c==="r"){ if(to.r===7&&to.c===0) ns.castle.wq=false; if(to.r===7&&to.c===7) ns.castle.wk=false; if(to.r===0&&to.c===0) ns.castle.bq=false; if(to.r===0&&to.c===7) ns.castle.bk=false; }
 if(piece.c==="p"&&Math.abs(to.r-fr.r)===2) ns.ep=((fr.r+to.r)/2)*8+fr.c;
 if(piece.s==="b") ns.moveNumber++;
 return ns;
}
function legalMoves(state,side){ let all=[]; for(let r=0;r<8;r++) for(let c=0;c<8;c++){ let p=state.board[r][c]; if(!p||p.s!==side) continue; let pseudo=pseudoMoves(state,r,c,false); for(let m of pseudo){ let ns=applyMove(state,m,"q"); if(!isCheckState(ns,side)) all.push(m); } } return all; }
function notation(state,m,promo){ let from=locate(m.fr),to=locate(m.to),p=state.board[from.r][from.c]; if(m.flags.castle) return m.flags.castle==="k"?"O-O":"O-O-O"; let text=""; if(p.c!=="p") text+=p.c.toUpperCase(); if(m.flags.capture||m.flags.ep){ if(p.c==="p") text+=files[from.c]; text+="x"; } else text+="-"; text+=files[to.c]+(8-to.r); if(m.flags.promo) text+="="+(promo||"q").toUpperCase(); return text; }
function checkGame(state){
 let moves=legalMoves(state,state.turn); if(moves.length===0){ gameOver=true; if(isCheckState(state,state.turn)){ messageEl.textContent=state.turn===playerSide&&mode==="bot"?"CHECKMATE — BOT WINS":"CHECKMATE — "+(state.turn==="w"?"BLACK":"WHITE")+" WINS"; } else { messageEl.textContent="STALEMATE — DRAW"; } updateUI(); return true; }
 if(isCheckState(state,state.turn)){ messageEl.textContent="CHECK!"; sndCheck(); } else { messageEl.textContent=mode==="friend"?(turn==="w"?"WHITE turn":"BLACK turn"):(turn===playerSide?"Your turn":"Bot thinking..."); }
 return false;
}
function render(){
 let frag=document.createDocumentFragment();
 let current=getState(); let normalForWhite=flip?playerSide!=="w":playerSide==="w";
 boardEl.innerHTML="";
 for(let vr=0;vr<8;vr++) for(let vc=0;vc<8;vc++){
  let r=normalForWhite?vr:7-vr, c=normalForWhite?vc:7-vc, idx=squareIndex(r,c);
  let cell=document.createElement("div"); cell.className="square "+((r+c)%2===0?"light":"dark");
  if(idx===selected) cell.classList.add("selected");
  if(idx===lastFrom||idx===lastTo) cell.classList.add("last");
  if(selectedMoves.some(m=>m.to===idx)) cell.classList.add(board[r][c]?"captureHint":"moveHint");
  if(board[r][c]&&board[r][c].c==="k"&&isCheckState(current,board[r][c].s)) cell.classList.add("check");
  if(board[r][c]){
   let sh=document.createElement("div"); sh.className="shadow"; cell.appendChild(sh);
   let piece=document.createElement("div"); piece.className="piece "+(board[r][c].s==="w"?"whitePiece":"blackPiece"); piece.textContent=glyph[board[r][c].s][board[r][c].c];
   if(view3D) piece.style.transform="translateZ(22px) rotateX(-18deg)"; else piece.style.transform="translateZ(0px)";
   cell.appendChild(piece);
  }
  let coord=document.createElement("div"); coord.className="coord"; coord.textContent=files[c]+(8-r); cell.appendChild(coord);
  cell.addEventListener("click", ()=>clickSquare(r,c));
  frag.appendChild(cell);
 }
 boardEl.appendChild(frag);
}
function updateUI(){
 if(!gameStarted) statusEl.textContent="3D READY"; else if(gameOver) statusEl.textContent="GAME OVER"; else if(thinking) statusEl.textContent="BOT THINKING"; else statusEl.textContent=turn==="w"?"WHITE 3D":"BLACK 3D";
 turnValue.textContent=gameStarted?(turn==="w"?"WHITE":"BLACK"):"—"; moveValue.textContent=String(moveNumber);
 undoBtn.disabled=!gameStarted||thinking||history.length===0;
}
function selectSide(side){ if(gameStarted) return; selectedSide=side; playWhiteBtn.classList.toggle("selected",side==="w"); playBlackBtn.classList.toggle("selected",side==="b"); startBtn.disabled=false; matchSummary.textContent=side==="w"?"You are WHITE - 3D":"You are BLACK - 3D"; }
function startGame(){ if(gameStarted||!selectedSide) return; mode=modeSel.value; playerSide=selectedSide; botSide=opposite(playerSide); gameStarted=true; gameOver=false; thinking=false; selected=-1; selectedMoves=[]; subTitle.textContent=mode==="friend"?"FRIEND 3D REAL":"BOT 3D - "+playerSide.toUpperCase(); startOverlay.classList.add("hidden"); audio(); render(); updateUI(); if(mode==="bot"&&turn===botSide){ thinking=true; messageEl.textContent="Bot opening 3D..."; updateUI(); setTimeout(botMove,80);} else { messageEl.textContent=mode==="friend"?"White to move - pass phone":"Your turn in 3D"; } }
function clickSquare(r,c){
 if(!gameStarted||thinking||gameOver) return;
 if(mode==="bot"&&turn!==playerSide) return;
 let idx=squareIndex(r,c);
 if(selected>=0){ let move=selectedMoves.find(m=>m.to===idx); if(move){ doMove(move); return; } }
 let p=board[r][c]; if(p&&p.s===turn){ selected=idx; selectedMoves=legalMoves(getState(),turn).filter(m=>m.fr===idx); messageEl.textContent=selectedMoves.length?"Choose square (3D)":"No moves"; render(); return; }
 selected=-1; selectedMoves=[]; render();
}
function doMove(m){
 let state=getState(); history.push(state); let promotion="q"; if(m.flags.promo){ let ans=window.prompt("Promote to Q,R,B,N","Q"); if(ans&&"qrbn".includes(ans.toLowerCase())) promotion=ans.toLowerCase(); }
 let isCap=!!state.board[locate(m.to).r][locate(m.to).c]||m.flags.ep;
 let text=notation(state,m,promotion); let ns=applyMove(state,m,promotion); board=ns.board; turn=ns.turn; castle=ns.castle; ep=ns.ep; moveNumber=ns.moveNumber; lastFrom=m.fr; lastTo=m.to; selected=-1; selectedMoves=[]; lastValue.textContent=text;
 if(isCap) sndCap(); else sndMove();
 if(checkGame(getState())){ render(); updateUI(); return; }
 if(mode==="bot"){ thinking=true; messageEl.textContent="Bot thinking..."; render(); updateUI(); setTimeout(botMove,120); } else { messageEl.textContent=turn==="w"?"White turn - pass phone":"Black turn"; render(); updateUI(); }
}
function evaluate(state){ let score=0; for(let r=0;r<8;r++) for(let c=0;c<8;c++){ let p=state.board[r][c]; if(!p) continue; let v=value[p.c]; if(p.c==="p"){ let adv=p.s==="w"?6-r:r-1; v+=adv*6; } if(p.c==="n"||p.c==="b"){ if(r>=2&&r<=5&&c>=2&&c<=5) v+=14; } if(p.s==="w") score+=v; else score-=v; } if(isCheckState(state,"w")) score-=35; if(isCheckState(state,"b")) score+=35; return score; }
function orderedMoves(state,moves){ return moves.map(m=>{ let to=locate(m.to),target=state.board[to.r][to.c],score=0; if(target) score+=1000+value[target.c]; if(m.flags.promo) score+=9000; if(m.flags.castle) score+=100; if(m.flags.ep) score+=800; return {m,score}; }).sort((a,b)=>b.score-a.score).map(x=>x.m); }
function minimax(state,depth,alpha,beta){ let moves=legalMoves(state,state.turn); if(moves.length===0){ if(isCheckState(state,state.turn)){ if(state.turn==="w") return -1000000-depth; return 1000000+depth; } return 0; } if(depth<=0) return evaluate(state); let ordered=orderedMoves(state,moves); if(state.turn==="w"){ let best=-Infinity; for(let m of ordered){ let ns=applyMove(state,m,"q"); let score=minimax(ns,depth-1,alpha,beta); if(score>best) best=score; if(best>alpha) alpha=best; if(beta<=alpha) break; } return best; } let best=Infinity; for(let m of ordered){ let ns=applyMove(state,m,"q"); let score=minimax(ns,depth-1,alpha,beta); if(score<best) best=score; if(best<beta) beta=best; if(beta<=alpha) break; } return best; }
function botMove(){ if(!gameStarted||gameOver||turn!==botSide){ thinking=false; updateUI(); return; } let state=getState(); let moves=orderedMoves(state,legalMoves(state,botSide)); if(!moves.length){ thinking=false; checkGame(state); render(); updateUI(); return; } let bestMove=moves[0]; let bestScore=botSide==="w"?-Infinity:Infinity; let depth=2; for(let m of moves){ let ns=applyMove(state,m,"q"); let score=minimax(ns,depth-1,-Infinity,Infinity); if(botSide==="w"){ if(score>bestScore){ bestScore=score; bestMove=m; } } else { if(score<bestScore){ bestScore=score; bestMove=m; } } } history.push(state); let ns=applyMove(state,bestMove,"q"); board=ns.board; turn=ns.turn; castle=ns.castle; ep=ns.ep; moveNumber=ns.moveNumber; lastFrom=bestMove.fr; lastTo=bestMove.to; let text=notation(state,bestMove,"q"); lastValue.textContent=text; let isCap=!!state.board[locate(bestMove.to).r][locate(bestMove.to).c]||bestMove.flags.ep; if(isCap) sndCap(); else sndMove(); thinking=false; let ended=checkGame(getState()); render(); updateUI(); if(!ended) messageEl.textContent="Your turn 3D"; }
function newGame(){ board=newBoard(); turn="w"; selected=-1; selectedMoves=[]; history=[]; castle={wk:true,wq:true,bk:true,bq:true}; ep=-1; lastFrom=-1; lastTo=-1; moveNumber=1; thinking=false; gameOver=false; gameStarted=false; selectedSide=null; playerSide="w"; botSide="b"; messageEl.textContent="Choose side 3D"; lastValue.textContent="—"; playWhiteBtn.classList.remove("selected"); playBlackBtn.classList.remove("selected"); startBtn.disabled=true; matchSummary.textContent="Select WHITE or BLACK - 3D"; subTitle.textContent="3D • SOUND • 2P REAL"; startOverlay.classList.remove("hidden"); render(); updateUI(); }
playWhiteBtn.addEventListener("click",()=>selectSide("w")); playBlackBtn.addEventListener("click",()=>selectSide("b")); startBtn.addEventListener("click",startGame);
newBtn.addEventListener("click",newGame);
undoBtn.addEventListener("click",()=>{ if(!history.length) return; let prev=history.pop(); board=prev.board; turn=prev.turn; castle=prev.castle; ep=prev.ep; moveNumber=prev.moveNumber; selected=-1; selectedMoves=[]; gameOver=false; thinking=false; messageEl.textContent="Undo 3D"; render(); updateUI(); });
flipBtn.addEventListener("click",()=>{ flip=!flip; render(); });
viewBtn.addEventListener("click",()=>{ set3D(!view3D); viewSel.value=view3D?"3d":"2d"; render(); });
viewSel.addEventListener("change",e=>{ set3D(e.target.value==="3d"); render(); });
muteBtn.addEventListener("click",()=>{ soundOn=!soundOn; muteBtn.textContent=soundOn?"🔊 SOUND":"🔇 MUTE"; if(soundOn) audio(); });
modeSel.addEventListener("change",e=>{ mode=e.target.value; if(gameStarted){ subTitle.textContent=mode==="friend"?"FRIEND 3D REAL":"BOT 3D"; messageEl.textContent=mode==="friend"?"Friend mode 3D - pass phone":"Bot mode 3D"; updateUI(); }});
newGame();
})();
</script>
`.trim();

export default {
  name: 'chess2',
  aliases: ['chess3d2', 'neonchess2'],
  category: 'games',
  description: 'Full 3D chess in chat — play vs the bot or vs a friend, 3D/2D view, sound.',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    const rid = `nexora-chess3d-${Date.now()}`;
    const responseId = crypto.randomUUID();
    const certificateChain = loadCertificateChain();
    const payload = {
      response_id: rid,
      sections: [{
        view_model: {
          primitive: {
            __typename: 'GenAIaeacdsnwHtmlPrimitive',
            payload: CHESS_HTML,
            url: 'https://nexora.dev',
            trusted_sources: ['nexora.dev'],
          },
          __typename: 'GenAISingleLayoutViewModel',
        },
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
            messageDisclaimerText: '♚ Chess 3D by moonson • NEXORA MD',
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
              submessages: [{ messageType: 2, messageText: 'NEXORA MD • NEON CHESS 3D - BY MOONSON' }],
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
      console.warn('[chess] HTML relay failed, plain fallback:', err.message);
      await m.reply(
        '♚ *NEON CHESS 3D — NEXORA MD*\n\n' +
        'The 3D board could not be delivered as an interactive card on this chat.\n' +
        'Try again, or play with a friend on a real board while the bot is fixed.',
      );
    }
  },
};

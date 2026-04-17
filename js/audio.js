//  AUDIO
// ═══════════════════════════════════════════════════════
let audioCtx = null;
function ac(){ if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)(); return audioCtx; }

function tone(freq,type,dur,vol=0.26){
  try{
    const a=ac(),o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);
    o.type=type;o.frequency.value=freq;
    g.gain.setValueAtTime(vol,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,a.currentTime+dur);
    o.start();o.stop(a.currentTime+dur);
  }catch(e){}
}
function playPlop(){
  try{const a=ac(),o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);o.type="sine";
    o.frequency.setValueAtTime(300,a.currentTime);
    o.frequency.exponentialRampToValueAtTime(80,a.currentTime+.18);
    g.gain.setValueAtTime(.2,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.22);
    o.start();o.stop(a.currentTime+.25);
  }catch(e){}
}
function playBite(){ tone(500,"sine",.11,.24); setTimeout(()=>tone(660,"sine",.14,.24),95); }
function playTick(){ tone(190+Math.random()*40,"triangle",.05,.07); }
function playSuccess(){ [520,660,780,1040].forEach((f,i)=>setTimeout(()=>tone(f,"sine",.3,.2),i*85)); }
function playDiscovery(){ [400,520,660,800,1040].forEach((f,i)=>setTimeout(()=>tone(f,"sine",.35,.18),i*70)); }
function playShiny(){ [880,1100,1320].forEach((f,i)=>setTimeout(()=>tone(f,"sine",.25,.16),i*60)); }
function playEscape(){ tone(280,"sine",.38,.12); setTimeout(()=>tone(210,"sine",.38,.08),190); }

// ═══════════════════════════════════════════════════════

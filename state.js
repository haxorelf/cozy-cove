// ═══════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════
const S = {
  coins: 0,
  bagSell: [],      // fish to sell
  bagKept: [],      // fish player kept
  journal: {},      // { fishId: { count, largest, shinyCount } }
  upgradeLevels: { rod:0, reel:0 },
  discovered: new Set(),
  baitInv: {},      // { baitId: quantity }
  ownedRods:   ["basic"],
  ownedReels:  ["basic"],
  completedGoals: new Set(), // goal ids already claimed
  surpriseTimer: 0,
  fishShadow: null, // ambient fish shadow surprise

  phase: "idle",
  power: 0, powerDir: 1,
  bobberX:0, bobberY:0, bobberDip:0,
  tension:50, reelProgress:0,
  activeFish:null, isReeling:false,
  reelHoldMs: 0,       // how long reel has been continuously held
  reelHoldRequired: 80, // ms of continuous hold before progress counts (reduced for feel)
  biteTimer:null, hookTimeout:null,
  waterAnim:0, ripples:[],
  tickFrame:0, legendaryTimer:0,

  invTab: "sell",
  skyTime: 0,       // 0–1 continuous cycle for day feel
  birds: [],        // ambient bird silhouettes
  sparkles: [],     // water surface sparkles
  birdSpawnTimer: 0,
};

// ═══════════════════════════════════════════════════════
//  SKY PALETTE — gentle shifts (dawn→morning→afternoon→dusk)
// ═══════════════════════════════════════════════════════
const SKY_STOPS = [
  { top:"#f7c59f", bot:"#fde8c8", water:"#6ab0cc", light:0.7 }, // warm dawn
  { top:"#a8d8ea", bot:"#d4effa", water:"#5db8d8", light:1.0 }, // clear morning
  { top:"#6ec6e6", bot:"#b8e4f5", water:"#4aa8c8", light:1.0 }, // bright noon
  { top:"#95c8e0", bot:"#cce8f4", water:"#52aac8", light:0.9 }, // afternoon
  { top:"#e8a070", bot:"#f5d0a0", water:"#5898b0", light:0.65 }, // soft dusk
  { top:"#f7c59f", bot:"#fde8c8", water:"#6ab0cc", light:0.7 }, // back to dawn
];

function lerpColor(a, b, t) {
  // handles both hex (#rrggbb) and rgb(...) strings
  function parse(c){
    if(c[0]==='#'){ const v=parseInt(c.slice(1),16); return [v>>16,(v>>8)&255,v&255]; }
    const m=c.match(/\d+/g); return m.map(Number);
  }
  const [ar,ag,ab]=parse(a), [br,bg,bb]=parse(b);
  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
}

function getSkyColors() {
  const n = SKY_STOPS.length - 1;
  const pos = S.skyTime * n;
  const i = Math.floor(pos), t = pos - i;
  const a = SKY_STOPS[Math.min(i,   n)];
  const b = SKY_STOPS[Math.min(i+1, n)];
  return {
    top:   lerpColor(a.top,   b.top,   t),
    bot:   lerpColor(a.bot,   b.bot,   t),
    water: lerpColor(a.water, b.water, t),
    light: a.light + (b.light - a.light) * t,
  };
}

// ── AMBIENT NATURE ──────────────────────────────────────
function tickAmbient(dt){
  // Spawn birds occasionally
  S.birdSpawnTimer -= dt;
  if(S.birdSpawnTimer <= 0){
    S.birdSpawnTimer = 8000 + Math.random() * 14000;
    spawnBird();
  }
  // Move birds
  S.birds = (S.birds||[]).filter(b => b.x < W + 60);
  S.birds.forEach(b => {
    b.x += b.speed * (dt/16);
    b.y += Math.sin(b.x * 0.03 + b.phase) * 0.3;
    b.flapT += dt * 0.004;
  });
  // Sparkles
  if(Math.random() < 0.04) spawnSparkle();
  S.sparkles = (S.sparkles||[]).filter(sp => sp.life > 0);
  S.sparkles.forEach(sp => { sp.life -= dt * 0.0015; sp.x += sp.dx * (dt/16); });

  // ── Surprise events ── rare, soft, non-intrusive
  S.surpriseTimer -= dt;
  if(S.surpriseTimer <= 0){
    S.surpriseTimer = 18000 + Math.random() * 30000; // every 18-48 seconds
    triggerSurprise();
  }
}

function triggerSurprise(){
  const roll = Math.random();
  if(roll < 0.4){
    // Splash burst — ripples at random water point
    const sx = W * 0.30 + Math.random() * W * 0.55;
    const sy = ENV.shorelineEdgeY - 130 + Math.random() * 110; // water region
    for(let i=0;i<6;i++) S.ripples.push({x:sx,y:sy,r:2+i*5,alpha:.5});
    spawn(sx, sy, "#a8d8f0", 5);
  } else if(roll < 0.7){
    // Sparkle surge — extra shimmer burst
    for(let i=0;i<8;i++) spawnSparkle();
  } else {
    // Fish shadow briefly visible — adds mystery
    S.fishShadow = {
      x: W * 0.45 + Math.random() * W * 0.35,
      y: H * 0.56 + Math.random() * H * 0.25,
      alpha: 0.35,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 0.5,
    };
  }
}

function spawnBird(){
  S.birds.push({
    x: -50,
    y: H * 0.15 + Math.random() * H * 0.18,
    speed: 0.6 + Math.random() * 0.5,
    scale: 0.5 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    flapT: Math.random() * Math.PI * 2,
  });
}

function spawnSparkle(){
  S.sparkles.push({
    x: W * 0.30 + Math.random() * W * 0.65,
    y: ENV.shorelineEdgeY - 180 + Math.random() * 160, // water region
    life: 0.6 + Math.random() * 0.4,
    dx: (Math.random() - 0.5) * 0.3,
    size: 1 + Math.random() * 2,
  });
}

function drawBird(b){
  const flap = Math.sin(b.flapT) * 0.4; // wing angle
  const s = b.scale;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(s, s);
  ctx.strokeStyle = `rgba(60,60,80,0.55)`;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  // Left wing
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -6 + flap * 8, -16, flap * 5);
  // Right wing
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(8, -6 + flap * 8, 16, flap * 5);
  ctx.stroke();
  ctx.restore();
}

function drawReeds(){
  // Reeds anchored to shoreline edge
  const reedPositions = [W*0.33, W*0.355, W*0.365, W*0.375];
  reedPositions.forEach((rx, i) => {
    const sway = Math.sin(S.waterAnim * 0.7 + i * 1.2) * 2;
    const ry = ENV.shorelineEdgeY - 18 + i * 3; // sits just above waterline
    ctx.strokeStyle = "rgba(100,130,60,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry + 20);
    ctx.quadraticCurveTo(rx + sway, ry + 10, rx + sway * 1.5, ry - 10);
    ctx.stroke();
    // Reed head
    ctx.fillStyle = "rgba(120,90,40,0.6)";
    ctx.beginPath();
    ctx.ellipse(rx + sway * 1.5, ry - 14, 2.5, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSparkles(light){
  S.sparkles.forEach(sp => {
    const a = sp.life * 0.7 * light;
    ctx.fillStyle = `rgba(255,255,220,${a})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ═══════════════════════════════════════════════════════

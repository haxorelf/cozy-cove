//  CANVAS SETUP
// ═══════════════════════════════════════════════════════
const cv=document.getElementById("gameCanvas"),ctx=cv.getContext("2d");
const W=800,H=520; cv.width=W; cv.height=H;
const RX=175; let RY=260; // RY is updated after ENV is defined — see RY_COMPUTED below

// ═══════════════════════════════════════════════════════
//  ENVIRONMENT LAYOUT
// ═══════════════════════════════════════════════════════
//
//  Background image: Shoreline.png (2000×1068)
//  Drawn to fill the full 800×520 canvas (fit-height, crop sides).
//    draw width  = 800 * (520/427) ≈ 974px  (centred → -87px offset)
//    draw height = 520px
//
//  The curved near-bank dark outline in the image sits at:
//    canvas y ≈ 360px at player x (RX=200)
//  That is shorelineEdgeY — the single source of truth.
//
//  Trees are part of the background image; no separate tree sprites needed.
//  Water.png is no longer used.
//
// ── TWEAK KNOBS ──────────────────────────────────────────────────────────────
const ENV = {

  // ── Background image sizing ──────────────────────────────────────────────
  // Image is 2000×1068 native. We fit to canvas height (520px).
  // Aspect: 2000/1068 = 1.873. At height=520 → width = 974px.
  // To centre horizontally: x offset = -(974-800)/2 = -87px.
  BG_W:  974,    // drawn width  — increase to zoom in, decrease to zoom out
  BG_H:  520,    // drawn height — always fill canvas height
  BG_X:  -87,    // x offset: negative centres wider image on canvas
  BG_Y:    0,    // y offset: 0 = top of canvas; negative crops top of image

  // ── Shore boundary ───────────────────────────────────────────────────────
  // The dark curved outline of the near bank sits at ~y=360 at player x.
  // This is the boundary: land above, water below.
  shorelineEdgeY: 375,  // ← MASTER KNOB (canvas px). Bumped 368→375: shifts land/water
                        // boundary down so character reads as further south on the bank.

  // ── Player grounding ─────────────────────────────────────────────────────
  // Stool removed. Feet bottom = RY + 53. Ground feet at shorelineEdgeY.
  // Offset reduced 62→56 so feet land closer to the curved shoreline edge.
  get RY_VALUE(){ return this.shorelineEdgeY - 48; }, // feet grounded on shoreline curve
};

// Apply to RY (declared as `let` at canvas-setup)
RY = ENV.RY_VALUE;

// ═══════════════════════════════════════════════════════
//  DRAW
// ═══════════════════════════════════════════════════════
function draw(){
  try {
  ctx.clearRect(0,0,W,H);
  const sky = getSkyColors();

  // ── LAYER 1: BACKGROUND  ─────────────────────────────────────────────────
  // Shoreline.png is the complete scene (sky, trees, bank, water).
  // Drawn fit-to-height, centred horizontally.
  if(ENV_IMGS.shoreline && ENV_IMGS.shoreline.complete && ENV_IMGS.shoreline.naturalWidth){
    ctx.drawImage(ENV_IMGS.shoreline, ENV.BG_X, ENV.BG_Y, ENV.BG_W, ENV.BG_H);
  } else {
    // Fallback: plain sky + water while image loads
    ctx.fillStyle = sky.top;
    ctx.fillRect(0, 0, W, ENV.shorelineEdgeY);
    ctx.fillStyle = sky.water;
    ctx.fillRect(0, ENV.shorelineEdgeY, W, H - ENV.shorelineEdgeY);
  }

  // ── Time-of-day tint (dawn/dusk/night) ───────────────────────────────────
  if(sky.light < 0.92){
    ctx.fillStyle = `rgba(255,180,80,${(0.92 - sky.light) * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Clouds & birds (sky layer) ───────────────────────────────────────────
  cloud(80, 55, .85); cloud(340, 38, 1.0); cloud(600, 62, .72);
  S.birds.forEach(b => drawBird(b));

  // ── Water shimmer (water region only) ────────────────────────────────────
  S.waterAnim += .03;
  for(let i = 0; i < 7; i++){
    const wx = W*0.32 + i*58 + Math.sin(S.waterAnim + i*0.7)*14;
    const wy = ENV.shorelineEdgeY - 55 + i*18 + Math.sin(S.waterAnim*0.8 + i)*4;
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + sky.light * 0.06})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx+26, wy); ctx.stroke();
  }

  // ── Sparkles ─────────────────────────────────────────────────────────────
  drawSparkles(sky.light);

  // ── Ripples ──────────────────────────────────────────────────────────────
  S.ripples = (S.ripples||[]).filter(r => r.alpha > 0);
  S.ripples.forEach(r => {
    r.r += 1.5; r.alpha -= .012;
    ctx.strokeStyle = `rgba(255,255,255,${r.alpha})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
  });

  // ── Reeds at shore edge ───────────────────────────────────────────────────
  drawReeds();

  // ── Fish shadow ambient ───────────────────────────────────────────────────
  if(S.fishShadow){
    const sh = S.fishShadow;
    sh.x += sh.vx; sh.y += sh.vy; sh.alpha -= 0.003;
    if(sh.alpha <= 0){ S.fishShadow = null; }
    else {
      ctx.save(); ctx.globalAlpha = sh.alpha * 0.6;
      ctx.fillStyle = "#1a5068";
      ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 22, 9, sh.vx*0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sh.x+20,sh.y); ctx.lineTo(sh.x+30,sh.y-7); ctx.lineTo(sh.x+30,sh.y+7);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  // ── LAYER 2: PLAYER  ─────────────────────────────────────────────────────
  // Drawn AFTER the background image — player always renders on top of shoreline.
  // RX (x position) and RY (y position) are the player anchor. RY = shorelineEdgeY - 56.
  // drawRod → drawBobber → drawAngler ensures rod line is behind character body.
  drawRod();
  if(["casting","waiting","hooking","reeling"].includes(S.phase)) drawBobber();
  drawAngler();
  if(S.phase==="reeling" && S.activeFish) drawFishSilhouette();

  // ── LAYER 3: UI (HTML overlay, not drawn here) ────────────────────────────

  } catch(e){ console.error("[draw]", e); }
}


function cloud(x,y,sc){
  ctx.fillStyle="rgba(255,255,255,.82)";
  ctx.beginPath();
  ctx.arc(x,y,20*sc,0,Math.PI*2);
  ctx.arc(x+22*sc,y-6*sc,16*sc,0,Math.PI*2);
  ctx.arc(x+42*sc,y,18*sc,0,Math.PI*2);
  ctx.arc(x+20*sc,y+8*sc,14*sc,0,Math.PI*2);
  ctx.fill();
}

function drawRod(){
  const rod = ROD_DB.find(r=>r.id===equipped.rod) || ROD_DB[0];

  // Rod tip position scales with rod reach
  const tipX = RX + 20 + rod.reach * 0.5;
  const tipY = RY - 40 - rod.reach;

  // Rod body
  ctx.strokeStyle = rod.color;
  ctx.lineWidth   = rod.width;
  ctx.lineCap     = "round";
  ctx.beginPath();
  ctx.moveTo(RX-30, RY+20);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Tip highlight
  ctx.strokeStyle = rod.highlight;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(RX+5, RY-25);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Guide rings (level 1+)
  if(rod.level >= 1){
    const rings = rod.level >= 3 ? 3 : rod.level >= 2 ? 2 : 1;
    for(let i=1;i<=rings;i++){
      const t = i/(rings+1);
      const rx2 = (RX-30)+(tipX-(RX-30))*t;
      const ry2 = (RY+20)+(tipY-(RY+20))*t;
      ctx.strokeStyle = rod.highlight; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(rx2,ry2,3,0,Math.PI*2); ctx.stroke();
    }
  }

  // Reel from equipped item
  const reelItem = REEL_DB.find(r=>r.id===equipped.reel) || REEL_DB[0];
  const reelSize = reelItem.size;
  ctx.fillStyle = reelItem.color;
  ctx.beginPath(); ctx.arc(RX-14, RY+8, reelSize, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.25)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(RX-14, RY+8, reelSize*0.55, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle=reelItem.color; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(RX-14+reelSize, RY+8); ctx.lineTo(RX-14+reelSize+5, RY+4); ctx.stroke();
  ctx.fillStyle="#333"; ctx.beginPath(); ctx.arc(RX-14+reelSize+5, RY+4, 2.5, 0, Math.PI*2); ctx.fill();
}

function drawAngler(){
  const outfit=COSMETICS.outfits.find(o=>o.id===equipped.outfit);
  const hat=COSMETICS.hats.find(h=>h.id===equipped.hat);

  ctx.fillStyle=outfit.color;
  ctx.fillRect(RX-65,RY-5,28,38);
  ctx.fillStyle="#f5c5a3";
  ctx.beginPath();ctx.arc(RX-51,RY-18,14,0,Math.PI*2);ctx.fill();

  // Hat
  if(equipped.hat==="none"){
    ctx.fillStyle="#8b4513";
    ctx.fillRect(RX-64,RY-32,30,6);ctx.fillRect(RX-60,RY-42,22,12);
  } else {
    ctx.font="22px serif"; ctx.textAlign="center";
    ctx.fillText(hat.symbol,RX-51,RY-30);
  }

  ctx.fillStyle="#f5c5a3";ctx.fillRect(RX-50,RY+2,30,8);
  ctx.fillStyle="#2c3e50";ctx.fillRect(RX-63,RY+33,10,20);ctx.fillRect(RX-48,RY+33,10,20);
}

function drawBobber(){
  const bobberDef=COSMETICS.bobbers.find(b=>b.id===equipped.bobber);
  ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(RX+20,RY-40);ctx.lineTo(S.bobberX,S.bobberY);ctx.stroke();
  ctx.setLineDash([]);

  const idle=S.phase==="waiting"?Math.sin(Date.now()*.002)*3:0;
  const by=S.bobberY+idle+S.bobberDip;

  if(S.phase==="hooking") S.bobberDip=Math.min(20,S.bobberDip+1.4);

  // Bait glow — subtle pulse while waiting
  if(S.phase==="waiting" && equipped.bait!=="none"){
    const bait=BAIT_DB.find(b=>b.id===equipped.bait);
    const glowColors={ worm:"#a8e060", lure:"#60d0f0", heavybait:"#f0a030" };
    const pulse = 0.4 + Math.sin(Date.now()*0.003)*0.3;
    ctx.shadowColor = glowColors[equipped.bait] || "#fff";
    ctx.shadowBlur  = 8 * pulse;
  }

  if(S.phase==="hooking"){ ctx.shadowColor="#ffcc00"; ctx.shadowBlur=16; }
  if(S.activeFish&&S.activeFish.shiny){ ctx.shadowColor="#f5c842"; ctx.shadowBlur=20; }

  ctx.strokeStyle="#555";ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(S.bobberX,by-12);ctx.lineTo(S.bobberX,by+2);ctx.stroke();

  const tc=S.phase==="hooking"?"#ffcc00":bobberDef.topColor;
  ctx.fillStyle=tc;
  ctx.beginPath();ctx.arc(S.bobberX,by,7,Math.PI,0);ctx.fill();
  ctx.fillStyle=bobberDef.botColor;
  ctx.beginPath();ctx.arc(S.bobberX,by,7,0,Math.PI);ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.3)";ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(S.bobberX,by,7,0,Math.PI*2);ctx.stroke();
  ctx.shadowBlur=0;ctx.shadowColor="transparent";
}

function drawFishSilhouette(){
  if(!S.activeFish) return;
  const p = S.reelProgress / 100;
  const now = Date.now();

  // Hook point — where the line meets the mouth
  const hx = S.bobberX + (RX + 20 - S.bobberX) * p;
  const hy = S.bobberY + (RY - 40  - S.bobberY) * p;

  // Size scaled by fish type
  const sizeMap = { minnow:44, bass:60, trout:68, carp:76, koi:90,
                    pike:72, catfish:80, moonfish:58 };
  const w = sizeMap[S.activeFish.id] || 60;
  const h = w * 0.52;

  // ── Natural hanging angle ──────────────────────────────
  // Fish mouth is at hook. Body hangs DOWN due to gravity.
  // We want mouth pointing UP-LEFT toward the rod,
  // body drooping downward. Base droop = ~55° below horizontal.
  const baseHang = 0.95; // ~55° — body hangs well below mouth

  // Gentle alive wriggle — slow, calm
  const wriggleSpeed = S.isReeling ? 0.007 : 0.0025;
  const wriggleAmp   = S.isReeling ? 0.10  : 0.04;
  const wriggle = Math.sin(now * wriggleSpeed) * wriggleAmp;

  // Slight sway
  const sway = Math.sin(now * 0.0013 + 1.2) * 0.025;

  const totalAngle = baseHang + wriggle + sway;

  // ── Water ripples while reeling ────────────────────────
  if(S.isReeling && S.phase==="reeling"){
    const waterY = ENV.shorelineEdgeY; // anchored to shoreline boundary
    if(hy > waterY - 20){ // fish is near/in water
      if(Math.random() < 0.08){
        ripple(hx + Math.random()*20 - 10, hy + h*0.3);
      }
    }
  }

  const img = FISH_IMGS[S.activeFish.id];
  if(!img || !img.complete) {
    // Emoji fallback — also hang it naturally
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(totalAngle - Math.PI/2); // point emoji down
    ctx.globalAlpha = 0.8;
    ctx.font = "28px serif";
    ctx.textAlign = "center";
    ctx.fillText(S.activeFish.emoji, 0, 14);
    ctx.restore();
    return;
  }

  ctx.save();

  // Translate to hook point (mouth position)
  ctx.translate(hx, hy);

  // Rotate so fish hangs naturally:
  // Fish image faces LEFT (mouth on left edge).
  // We rotate so the mouth is up at hook, body hangs below-right.
  // totalAngle tilts the body downward from the hook.
  ctx.rotate(totalAngle);

  ctx.globalAlpha = S.activeFish.shiny ? 0.95 : 0.88;

  if(S.activeFish.shiny){
    ctx.shadowColor = "#f5c842";
    ctx.shadowBlur  = 18;
  }

  // Draw fish: mouth (left edge of image) sits at origin (hook point).
  // Body extends to the right along the rotated axis,
  // which now points downward — so body hangs below hook.
  // Slight vertical offset so the mouth tip is exactly at hook.
  ctx.drawImage(img, 0, -h * 0.45, w, h);

  ctx.restore();

  // ── Subtle line to mouth ───────────────────────────────
  // Draw a short leader from hook point to clarify connection
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(totalAngle)*8, hy + Math.sin(totalAngle)*8);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════

//  SAVE / LOAD SYSTEM
// ═══════════════════════════════════════════════════════
const SAVE_KEY     = "cozyCove_save";
const SAVE_VERSION = 6; // v6: reel as equippable item, ownedReels

let saveToastTimer = null;

function showSaveToast(){
  const el = document.getElementById("save-toast");
  el.classList.add("show");
  clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}

function saveGame(){
  try {
    const data = {
      version:       SAVE_VERSION,
      savedAt:       Date.now(),
      coins:         S.coins,
      upgradeLevels: { ...S.upgradeLevels },
      equipped:      { ...equipped },
      bagSell:       S.bagSell.map(f => stripFish(f)),
      bagKept:       S.bagKept.map(f => stripFish(f)),
      journal:       JSON.parse(JSON.stringify(S.journal)),
      discovered:    [...S.discovered],
      baitInv:          { ...S.baitInv },
      ownedRods:        [...S.ownedRods],
      ownedReels:       [...S.ownedReels],
      completedGoals:   [...S.completedGoals],
      cosmeticOwned:    gatherOwned(),
      currentCharacter: currentCharacter,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    showSaveToast();
  } catch(e) {
    console.warn("Save failed:", e);
  }
}

// Only keep fields needed to reconstruct a fish (strip image objects etc.)
function stripFish(f){
  return {
    id: f.id, name: f.name, emoji: f.emoji,
    weight: f.weight, value: f.value, baseValue: f.baseValue,
    shiny: f.shiny, color: f.color,
    rarity: f.rarity, difficulty: f.difficulty,
    spikeChance: f.spikeChance, spikeMin: f.spikeMin, spikeMax: f.spikeMax,
    legendary: f.legendary,
    weightMin: f.weightMin, weightMax: f.weightMax,
  };
}

function gatherOwned(){
  const owned = { hats:{}, outfits:{}, bobbers:{}, stools:{} };
  ["hats","outfits","bobbers","stools"].forEach(cat => {
    COSMETICS[cat].forEach(item => { owned[cat][item.id] = item.owned; });
  });
  return owned;
}

function loadGame(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false; // no save found

    const data = JSON.parse(raw);

    // Version check — if future versions add new fields, migrate here
    if(!data.version || data.version > SAVE_VERSION){
      console.warn("Save version mismatch — starting fresh");
      return false;
    }
    // v1 → v2 migration
    if(data.version < 2){
      if(data.equipped) data.equipped.stool = "wood";
      if(data.cosmeticOwned) data.cosmeticOwned.stools = { wood:true };
    }
    // v2 → v3 migration
    if(data.version < 3){
      if(data.equipped) data.equipped.bait = "none";
      data.baitInv = {};
    }
    // v3 → v4 migration: convert old rod upgrade level to owned rod item
    if(data.version < 4){
      const oldRodLv = data.upgradeLevels?.rod ?? 0;
      const rodMap   = { 0:"basic", 1:"oak", 2:"carbon", 3:"master" };
      const topRod   = rodMap[Math.min(oldRodLv, 3)];
      data.ownedRods = Object.values(rodMap).slice(0, oldRodLv + 1);
      if(data.equipped) data.equipped.rod = topRod;
      if(data.upgradeLevels) delete data.upgradeLevels.rod;
    }
    // v4 → v5 migration: add completedGoals if missing
    if(data.version < 5){
      data.completedGoals = [];
    }
    // v5 → v6 migration: convert reel upgrade level to owned reel item
    if(data.version < 6){
      const oldReelLv = data.upgradeLevels?.reel ?? 0;
      const reelMap   = { 0:"basic", 1:"smooth", 2:"turbo", 3:"master" };
      data.ownedReels = Object.values(reelMap).slice(0, oldReelLv + 1);
      if(data.equipped) data.equipped.reel = reelMap[Math.min(oldReelLv, 3)];
      if(data.upgradeLevels) delete data.upgradeLevels.reel;
    }

    // Restore state
    S.coins          = data.coins          ?? 0;
    S.upgradeLevels  = { ...data.upgradeLevels };
    S.bagSell        = (data.bagSell   ?? []).map(f => rehydrateFish(f));
    S.bagKept        = (data.bagKept   ?? []).map(f => rehydrateFish(f));
    S.journal        = data.journal    ?? {};
    S.discovered     = new Set(data.discovered    ?? []);
    S.baitInv        = data.baitInv    ?? {};
    S.ownedRods      = data.ownedRods  ?? ["basic"];
    S.ownedReels     = data.ownedReels ?? ["basic"];
    S.completedGoals = new Set(data.completedGoals ?? []);
    if(data.currentCharacter) currentCharacter = data.currentCharacter;

    // Restore equipped
    if(data.equipped){
      equipped.hat    = data.equipped.hat    ?? "none";
      equipped.outfit = data.equipped.outfit ?? "blue";
      equipped.bobber = data.equipped.bobber ?? "classic";
      equipped.stool  = data.equipped.stool  ?? "wood";
      equipped.bait   = data.equipped.bait   ?? "none";
      equipped.rod    = data.equipped.rod    ?? "basic";
      equipped.reel   = data.equipped.reel   ?? "basic";
      if(!S.ownedRods.includes(equipped.rod))   equipped.rod  = S.ownedRods[0]  ?? "basic";
      if(!S.ownedReels.includes(equipped.reel)) equipped.reel = S.ownedReels[0] ?? "basic";
    }

    // Restore cosmetic ownership
    if(data.cosmeticOwned){
      ["hats","outfits","bobbers","stools"].forEach(cat => {
        if(!data.cosmeticOwned[cat]) return;
        COSMETICS[cat].forEach(item => {
          if(data.cosmeticOwned[cat][item.id] !== undefined)
            item.owned = data.cosmeticOwned[cat][item.id];
        });
      });
    }

    // Re-apply upgrade effects and stats
    UPGRADES.forEach(u => {
      const lv = S.upgradeLevels[u.id] ?? 0;
      if(lv > 0) u.apply(lv);
    });
    applyStats();

    return true;
  } catch(e) {
    console.warn("Load failed:", e);
    return false;
  }
}

// Rehydrate a stripped fish back to a full fish object
function rehydrateFish(f){
  const template = FISH_DB.find(t => t.id === f.id) ?? FISH_DB[0];
  return { ...template, ...f }; // saved fields override template defaults
}



// ═══════════════════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════════════════
let lastT=0;
function loop(ts){
  const dt = Math.min(ts - lastT, 100); // cap dt to avoid huge jumps
  lastT = ts;

  // Sky time advance
  S.skyTime += dt / CONFIG.skyShiftMs;
  if(S.skyTime >= 1) S.skyTime = 0;

  tickAmbient(dt);
  draw();
  tickParticles();

  // Remove loading gate on/after first real frame
  _removeLoadingGate();

  requestAnimationFrame(loop);
}

resizeP(); window.addEventListener("resize",resizeP);

// ── Loading gate removal — wait for first canvas draw + chroma-key ──
// Hides the solid-colour overlay that prevents any startup flash.
let _gateRemoved = false;
function _removeLoadingGate() {
  if (_gateRemoved) return;
  if (!_coinChromaDone) return; // wait until coin icon is processed
  _gateRemoved = true;
  const gate = document.getElementById('loading-gate');
  if (gate) {
    gate.style.transition = 'opacity 0.15s';
    gate.style.opacity = '0';
    setTimeout(() => gate.remove(), 160);
  }
}

// ── Sync --mobile-bar-height CSS variable to actual rendered bar height ──────
// Prevents panels overlapping the bar when font-size/content causes it to grow
function syncMobileBarHeight(){
  const bar = document.getElementById("mobile-bar");
  if(!bar) return;
  const h = bar.offsetHeight;
  if(h > 0){
    document.documentElement.style.setProperty("--mobile-bar-height", h + "px");
  }
}
// Run on load, resize, and orientation change
syncMobileBarHeight();
window.addEventListener("resize", syncMobileBarHeight);
window.addEventListener("orientationchange", () => {
  // orientationchange fires before layout reflows — defer one frame
  requestAnimationFrame(syncMobileBarHeight);
});

// ── Prevent body scroll on canvas touch (no panning past background) ────
document.getElementById("gameCanvas").addEventListener("touchmove", e=>e.preventDefault(), {passive:false});

// Load save or start fresh
const hasSave = loadGame();
coinDisplay(); updateStatsDisplay(); updateBaitDisplay();
renderInv(); renderJournal(); renderGoals();

if(hasSave){
  showStatus("🎣 Welcome back! Your progress has been restored.",3500);
} else {
  showStatus("🌊 Welcome to Cozy Cove! Press CAST to start.",3500);
}

requestAnimationFrame(loop);



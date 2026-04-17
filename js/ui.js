//  PANELS
// ═══════════════════════════════════════════════════════
function togglePanel(id){
  ["inv-panel","journal-panel","shop-panel","char-panel","goals-panel"].forEach(p=>{
    if(p===id) document.getElementById(p).classList.toggle("active");
    else document.getElementById(p).classList.remove("active");
  });
  if(id==="inv-panel")     renderInv();
  if(id==="journal-panel") renderJournal();
  if(id==="shop-panel")    renderShop();
  if(id==="char-panel")    renderCharPanel();
  if(id==="goals-panel")   renderGoals();
}

// ═══════════════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════════════
castBtn.addEventListener("mousedown",()=>{
  if(S.phase==="idle")       startCast();
  else if(S.phase==="charging")  releaseCast();
  else if(S.phase==="hooking")   hookFish();
});
castBtn.addEventListener("touchstart",e=>{e.preventDefault();castBtn.dispatchEvent(new Event("mousedown"));},{passive:false});

reelBtn.addEventListener("mousedown",  ()=>S.isReeling=true);
reelBtn.addEventListener("mouseup",    ()=>S.isReeling=false);
reelBtn.addEventListener("mouseleave", ()=>S.isReeling=false);
reelBtn.addEventListener("touchstart", e=>{e.preventDefault();S.isReeling=true;},{passive:false});
reelBtn.addEventListener("touchend",   e=>{e.preventDefault();S.isReeling=false;},{passive:false});

// ═══════════════════════════════════════════════════════
//  RESET SAVE  (defined before event listeners)
// ═══════════════════════════════════════════════════════
function resetSave(){
  // Show custom in-game confirm dialog (browser confirm() is blocked in local files)
  document.getElementById("confirm-overlay").classList.add("show");
}

function doReset(){
  document.getElementById("confirm-overlay").classList.remove("show");

  // 1. Wipe localStorage
  localStorage.removeItem(SAVE_KEY);

  // 2. Reset coins & inventory
  S.coins          = 0;
  S.bagSell        = [];
  S.bagKept        = [];
  S.journal        = {};
  S.discovered     = new Set();
  S.completedGoals = new Set();

  // 3. Reset upgrade levels — now empty (all gear is equippable items)
  S.upgradeLevels = {};

  // 4. Reset equipped
  equipped.hat    = "none";
  equipped.outfit = "blue";
  equipped.bobber = "classic";
  equipped.stool  = "wood";
  equipped.bait   = "none";
  equipped.rod    = "basic";
  equipped.reel   = "basic";

  // 5. Reset rod and reel ownership
  S.ownedRods   = ["basic"];
  S.ownedReels  = ["basic"];

  // 6. Reset bait inventory
  S.baitInv = {};

  // 6. Reset cosmetic ownership — only free items stay owned
  ["hats","outfits","bobbers","stools"].forEach(cat => {
    COSMETICS[cat].forEach(item => { item.owned = (item.price === 0); });
  });

  // 7. Reset CONFIG values modified by upgrades/stats
  CONFIG.tensionBreakThreshold = 90;
  CONFIG.reelProgressPerFrame  = 1.15;
  CONFIG.tensionDecayRate      = 0.42;
  CONFIG.shinyChance           = 0.06;

  // 8. Close any open panels
  ["inv-panel","journal-panel","shop-panel","char-panel","goals-panel"].forEach(p =>
    document.getElementById(p).classList.remove("active")
  );

  // 9. Refresh all UI
  coinDisplay();
  updateStatsDisplay();
  updateBaitDisplay();
  renderInv();
  renderJournal();
  renderShop();
  renderGoals();

  showStatus("🌱 Fresh start! Good luck out there.", 3000);
}

document.getElementById("popup-sell").addEventListener("click", sellFish);
document.getElementById("popup-keep").addEventListener("click", keepFish);
document.getElementById("reset-btn").addEventListener("click",  resetSave);

// Mobile button listeners — same actions as desktop
["shop","journal","char","inv","goals"].forEach(id => {
  const mBtn = document.getElementById(`m-${id}-btn`);
  const dBtn = document.getElementById(`${id}-btn`);
  if(mBtn && dBtn) mBtn.addEventListener("click", () => dBtn.click());
});
const mReset = document.getElementById("m-reset-btn");
if(mReset) mReset.addEventListener("click", resetSave);

document.getElementById("confirm-ok").addEventListener("click",  doReset);
document.getElementById("confirm-cancel").addEventListener("click", () =>
  document.getElementById("confirm-overlay").classList.remove("show")
);
// sell-all handled inline in renderInv footer buttons
document.getElementById("inv-btn").addEventListener("click",()=>togglePanel("inv-panel"));
document.getElementById("journal-btn").addEventListener("click",()=>togglePanel("journal-panel"));
document.getElementById("char-btn").addEventListener("click",()=>togglePanel("char-panel"));
document.getElementById("shop-btn").addEventListener("click",()=>togglePanel("shop-panel"));
document.getElementById("goals-btn").addEventListener("click",()=>togglePanel("goals-panel"));

window.addEventListener("keydown",e=>{
  if(e.code==="Space"){
    e.preventDefault();
    if(e.repeat) return; // ignore key-repeat — Space must be physically re-pressed
    if(S.phase==="idle")       startCast();
    else if(S.phase==="charging")  releaseCast();
    else if(S.phase==="hooking")   hookFish();
    else if(S.phase==="reeling")   S.isReeling=true;
  }
  if(e.code==="Enter"&&S.phase==="caught") sellFish();
});
window.addEventListener("keyup",e=>{
  if(e.code==="Space") S.isReeling=false;
});

// ═══════════════════════════════════════════════════════

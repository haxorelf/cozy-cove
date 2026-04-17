//  PARTICLES
// ═══════════════════════════════════════════════════════
const pCv=document.getElementById("particleCv"), pCtx=pCv.getContext("2d");
let particles=[];
function resizeP(){ pCv.width=pCv.offsetWidth; pCv.height=pCv.offsetHeight; }
function spawn(x,y,color,n=8){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,s=1.5+Math.random()*2.5;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,alpha:.9,r:3+Math.random()*4,color});
  }
}
function tickParticles(){
  pCtx.clearRect(0,0,pCv.width,pCv.height);
  particles=particles.filter(p=>p.alpha>.05);
  particles.forEach(p=>{
    p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.alpha-=.024;
    pCtx.globalAlpha=p.alpha;pCtx.fillStyle=p.color;
    pCtx.beginPath();pCtx.arc(p.x,p.y,p.r,0,Math.PI*2);pCtx.fill();
  });
  pCtx.globalAlpha=1;
}

// ═══════════════════════════════════════════════════════

export const SPAWN = { x: 0, z: 13 };
export const PLAYER_RADIUS = 0.42;
export const HOUSES = [
  { x: -8, z: -5, w: 4.8, d: 4, color: 0xf0dcb8, roof: 0xd77054 },
  { x: 6, z: -11, w: 4.2, d: 3.8, color: 0xf4e9c8, roof: 0x527d8a },
  { x: 15, z: 1, w: 4, d: 3.6, color: 0xf1c879, roof: 0xbc674e },
];
export const TREES = [
  [-18,-6,1.2],[-19,1,1],[-15,8,1.1],[-11,12,.9],[-20,-11,1.05],[-13,-13,1.1],[-5,-16,1.1],
  [1,-17,1],[12,-13,1.2],[18,-8,1.15],[21,-2,.9],[20,7,1.15],[13,11,1.1],[8,14,.95],
  [-4,4,.85],[4,-2,1.05],[-12,1,.9],[-1,-8,1.1],[10,5,.8],[-17,12,.8],
];
export const ROCKS = [[-24,-3,1.2],[-20,9,.9],[-12,17,1],[18,13,1.1],[24,1,.8],[19,-13,1.1],[-15,-17,.8],[3,-20,.9]];
export const COINS = [[0,8],[3,3],[-7,1],[-8,-1],[-17,-8],[-10,-14],[2,-13],[10,-8],[18,-2],[15,8],[4,16],[-18,8]].map(([x,z],id) => ({id,x,z}));
export const OBSTACLES = [
  ...HOUSES.map(h => ({ kind: 'box', x:h.x,z:h.z,hx:h.w/2+.1,hz:h.d/2+.1 })),
  ...TREES.map(([x,z,s]) => ({kind:'circle',x,z,r:.4*s})),
  ...ROCKS.map(([x,z,s]) => ({kind:'circle',x,z,r:1.1*s})),
];
export function shoreRadius(angle) { return 1 + .035*Math.sin(angle*5) + .025*Math.cos(angle*3); }
export function groundHeight(x,z) {
  const q = Math.hypot(x/29,z/23) / shoreRadius(Math.atan2(z/23,x/29));
  const grass = 1-Math.max(0,Math.min(1,(q-.76)/.13));
  return .18 + grass * (.48 + .13*Math.sin(x*.17)*Math.cos(z*.19));
}
export function canStand(x,z) {
  const angle=Math.atan2(z/23,x/29);
  if(Math.hypot(x/29,z/23)>shoreRadius(angle)-.018) return false;
  for(const o of OBSTACLES) {
    if(o.kind==='circle') { if(Math.hypot(x-o.x,z-o.z)<o.r+PLAYER_RADIUS) return false; }
    else {
      const dx=Math.max(Math.abs(x-o.x)-o.hx,0), dz=Math.max(Math.abs(z-o.z)-o.hz,0);
      if(dx*dx+dz*dz<PLAYER_RADIUS*PLAYER_RADIUS) return false;
    }
  }
  return true;
}
export function createState() { return {x:SPAWN.x,z:SPAWN.z,vx:0,vz:0,heading:Math.PI,collected:new Set(),steps:0}; }
export function step(state, input, dt) {
  // Clamp long frames, then substep to prevent tunnelling through small objects.
  dt=Math.max(0,Math.min(dt,.05));
  let ix=(input.has('KeyD')||input.has('ArrowRight')?1:0)-(input.has('KeyA')||input.has('ArrowLeft')?1:0);
  let iz=(input.has('KeyS')||input.has('ArrowDown')?1:0)-(input.has('KeyW')||input.has('ArrowUp')?1:0);
  const length=Math.hypot(ix,iz); if(length>0) {ix/=length;iz/=length;}
  const speed=input.has('ShiftLeft')||input.has('ShiftRight')?7.4:4.6;
  const blend=1-Math.exp(-16*dt); state.vx+=(ix*speed-state.vx)*blend;state.vz+=(iz*speed-state.vz)*blend;
  const parts=Math.max(1,Math.ceil(dt/(1/120))),delta=dt/parts;
  let moved=0;
  for(let i=0;i<parts;i++) {
    const x=state.x+state.vx*delta,z=state.z+state.vz*delta;
    if(canStand(x,state.z)) {moved+=Math.abs(x-state.x);state.x=x;}
    if(canStand(state.x,z)) {moved+=Math.abs(z-state.z);state.z=z;}
  }
  if(length) state.heading=Math.atan2(ix,iz);
  state.steps+=moved;
  const added=[];
  for(const coin of COINS) if(!state.collected.has(coin.id)&&Math.hypot(state.x-coin.x,state.z-coin.z)<1.2) {state.collected.add(coin.id);added.push(coin.id);}
  return {moved,added};
}
export function regionAt(x,z) {
  if(Math.hypot(x/29,z/23)>.75||z>10) return 'Sunny shore';
  if(z<-5||x>11) return 'The little village';
  if(x<-10) return 'Palm grove';
  return 'The green meadow';
}
export function followCamera(current,player,dt,aspect=1.5) {
  const zoom=aspect<.85?1.22:1;
  const target={x:player.x,y:groundHeight(player.x,player.z)+18*zoom,z:player.z+22*zoom};
  const blend=1-Math.exp(-5*Math.max(0,Math.min(dt,.05)));
  return {x:current.x+(target.x-current.x)*blend,y:current.y+(target.y-current.y)*blend,z:current.z+(target.z-current.z)*blend};
}

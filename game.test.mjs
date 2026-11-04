import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,step,canStand,COINS,HOUSES,TREES,ROCKS,followCamera,SPAWN,groundHeight} from './app/game-model.mjs';
const advance=(s,keys,seconds,fps=60)=>{for(let n=0;n<seconds*fps;n++)step(s,new Set(keys),1/fps);return s;};
test('movement maps to screen axes; arrow keys and WASD agree',()=>{
  for(const [key,axis,sign] of [['KeyW','z',-1],['KeyS','z',1],['KeyA','x',-1],['KeyD','x',1]]) {
    const s=createState(),start=s[axis];advance(s,[key],.5);assert.ok((s[axis]-start)*sign>1.8);
  }
  assert.deepEqual(advance(createState(),['KeyW'],1),advance(createState(),['ArrowUp'],1));
});
test('diagonal speed is normalized, jogging is faster, released input stops',()=>{
  const a=advance(createState(),['KeyW'],.6),b=advance(createState(),['KeyW','KeyD'],.6),c=advance(createState(),['KeyW','ShiftLeft'],.6);
  assert.ok(Math.abs(Math.hypot(b.x,b.z-13)-Math.abs(a.z-13))<.02);assert.ok(c.z<a.z-.8);
  advance(a,[],1);assert.ok(Math.hypot(a.vx,a.vz)<.001);
});
test('solid houses, trees and rocks block movement; shoreline is safe',()=>{
  for(const o of [...HOUSES,...TREES.map(([x,z])=>({x,z})),...ROCKS.map(([x,z])=>({x,z}))])assert.equal(canStand(o.x,o.z),false);
  const s=createState();s.x=-8;s.z=1;advance(s,['KeyW','ShiftLeft'],4);assert.ok(s.z>-2.6);assert.ok(canStand(s.x,s.z));
  const edge=advance(createState(),['KeyS','ShiftLeft'],20);assert.ok(edge.z<24);assert.ok(canStand(edge.x,edge.z));
});
test('motion is stable at 30, 60 and 144 FPS and long frames cannot tunnel',()=>{
  const results=[30,60,144].map(fps=>advance(createState(),['KeyW'],1,fps).z);assert.ok(Math.max(...results)-Math.min(...results)<.08);
  const s=createState();step(s,new Set(['KeyW']),10);assert.ok(13-s.z<.3);
});
test('every coin is reachable from spawn using real collision map and movement',()=>{
  // Grid search validates continuous open paths around the complete obstacle layout.
  const grid=.4,key=(x,z)=>`${x},${z}`,start=[Math.round(SPAWN.x/grid),Math.round(SPAWN.z/grid)],queue=[start],parents=new Map([[key(...start),null]]);
  for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(!parents.has(k)&&canStand(nx*grid,nz*grid)){parents.set(k,[x,z]);queue.push([nx,nz]);}}}
  for(const coin of COINS){const target=[Math.round(coin.x/grid),Math.round(coin.z/grid)];assert.ok(parents.has(key(...target)),`coin ${coin.id} reachable`);const route=[];let p=target;while(p){route.push(p);p=parents.get(key(...p));}route.reverse();const s=createState();
    for(const [gx,gz]of route){const x=gx*grid,z=gz*grid;for(let tries=0;tries<90&&Math.hypot(s.x-x,s.z-z)>.13;tries++){const keys=[];if(Math.abs(x-s.x)>.06)keys.push(x>s.x?'KeyD':'KeyA');if(Math.abs(z-s.z)>.06)keys.push(z>s.z?'KeyS':'KeyW');step(s,new Set(keys),1/120);}}
    assert.ok(s.collected.has(coin.id),`coin ${coin.id} collectable by walking`);
  }
});
test('collection counts once and reset returns to empty spawn state',()=>{
  const s=createState();for(const c of COINS){s.x=c.x;s.z=c.z;step(s,new Set(),1/60);step(s,new Set(),1/60);}assert.equal(s.collected.size,12);
  const fresh=createState();assert.equal(fresh.collected.size,0);assert.deepEqual([fresh.x,fresh.z],[SPAWN.x,SPAWN.z]);assert.ok(canStand(fresh.x,fresh.z));
});
test('following camera converges without overshoot in landscape and portrait',()=>{
  for(const aspect of [1.7,.6]){let c={x:0,y:18,z:35};const player={x:12,z:-8};let previous=Infinity;for(let n=0;n<240;n++){c=followCamera(c,player,1/60,aspect);const d=Math.abs(c.x-player.x);assert.ok(d<=previous);previous=d;}assert.ok(previous<.001);assert.ok(c.y>groundHeight(player.x,player.z)+17);assert.ok(c.z>player.z+20);}
});

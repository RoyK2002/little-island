import * as THREE from 'three';
import { SPAWN, HOUSES, TREES, ROCKS, COINS, createState, step, groundHeight, shoreRadius, canStand, regionAt, followCamera } from './game-model.mjs';

export function createWorld(host, callbacks) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x62c6cc);
  scene.fog = new THREE.Fog(0x80cdd0, 60, 150);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label','Explore the island. W A S D or arrow keys move. Shift to jog. R to reset.');
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 180);
  scene.add(new THREE.HemisphereLight(0xe5faff, 0x6a8c4b, 2.3));
  const sun = new THREE.DirectionalLight(0xfff0cf, 3.2);
  sun.position.set(-25, 40, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera, {left:-42,right:42,top:37,bottom:-37,near:1,far:95});
  sun.shadow.bias = -.0007; sun.shadow.normalBias = .04; scene.add(sun);
  const materials = new Map();
  function material(color) {
    if(!materials.has(color)) materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88,flatShading:true}));
    return materials.get(color);
  }
  function mesh(geometry,color,parent=scene,x=0,y=0,z=0) {
    const object=new THREE.Mesh(geometry,material(color)); object.position.set(x,y,z);
    object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  }
  function box(w,h,d,color,parent,x=0,y=0,z=0) {return mesh(new THREE.BoxGeometry(w,h,d),color,parent,x,y,z);}
  function sphere(r,color,parent,x=0,y=0,z=0) {return mesh(new THREE.IcosahedronGeometry(r,1),color,parent,x,y,z);}
  let seed=921; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};

  // A single radial terrain mesh makes grass and beach meet without cracks.
  const positions=[],colors=[],indices=[],segments=120,rings=25;
  const sand=new THREE.Color(0xf3dca0),grass=new THREE.Color(0x79b953),lightGrass=new THREE.Color(0x8dc65a);
  for(let ring=0;ring<=rings;ring++) for(let j=0;j<=segments;j++) {
    const angle=j/segments*Math.PI*2,r=ring/rings,s=shoreRadius(angle);
    const x=Math.cos(angle)*29*r*s,z=Math.sin(angle)*23*r*s;
    positions.push(x,groundHeight(x,z),z);
    const c=r>.84?sand.clone():grass.clone().lerp(lightGrass,.3+.25*Math.sin(x*.3+z*.2));
    if(r>.8&&r<=.84)c.lerp(sand,(r-.8)/.04);
    colors.push(c.r,c.g,c.b);
    // Counter-clockwise from above: the terrain must face the player camera.
    if(ring<rings&&j<segments) {const a=ring*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
  }
  const terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrainGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeometry.setIndex(indices);terrainGeometry.computeVertexNormals();
  const terrain=new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));terrain.receiveShadow=true;scene.add(terrain);
  const water=mesh(new THREE.PlaneGeometry(360,360),0x29b5c5);water.rotation.x=-Math.PI/2;water.position.y=-.035;water.castShadow=false;
  // Shallow-water contour and two soft foam ribbons follow the actual shoreline.
  function shoreBand(inner,outer,color,opacity) {
    const p=[],ix=[];
    for(let i=0;i<=segments;i++) {const a=i/segments*Math.PI*2,s=shoreRadius(a);for(const r of [inner,outer])p.push(Math.cos(a)*29*s*r,.018,Math.sin(a)*23*s*r);if(i<segments){const n=i*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));scene.add(m);return m;
  }
  shoreBand(.995,1.1,0x9de0d5,.5);const foam=shoreBand(1.009,1.024,0xe7fff2,.72);const foam2=shoreBand(1.08,1.086,0xd6f5e8,.3);
  const ripples=[];
  for(let i=0;i<70;i++) {const x=(random()-.5)*120,z=(random()-.5)*110;if(Math.hypot(x/30,z/25)<1.1)continue;const line=box(.7+random()*1.6,.012,.045,0x91ddd6,scene,x,.025,z);line.castShadow=false;line.userData.phase=random()*6;ripples.push(line);}

  const occluders=[];
  function markOccluder(group,x,z,radius) {
    const mats=[];group.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;mats.push(o.material);}});occluders.push({group,x,z,radius,mats});
  }
  for(const h of HOUSES) {
    const home=new THREE.Group();home.position.set(h.x,groundHeight(h.x,h.z),h.z);scene.add(home);
    box(h.w+.3,.2,h.d+.3,0xc3b79c,home,0,.08,0);
    box(h.w,2.7,h.d,h.color,home,0,1.5,0);
    // Triangular prism roof with a wide overhang.
    const w=h.w/2+.45,d=h.d/2+.45;
    const roofGeometry=new THREE.BufferGeometry();roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,-d,w,0,-d,0,1.7,-d,-w,0,d,w,0,d,0,1.7,d],3));
    roofGeometry.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);roofGeometry.computeVertexNormals();mesh(roofGeometry,h.roof,home,0,2.84,0);
    const front=h.d/2+.025;
    box(.85,1.55,.12,0x446e68,home,0,.98,front);sphere(.065,0xffd179,home,.25,.96,front+.09);
    for(const x of [-h.w*.3,h.w*.3]) {
      box(.86,.94,.12,0xfff6dd,home,x,1.75,front);box(.65,.72,.14,0x76b3bc,home,x,1.76,front+.03);
      box(.065,.72,.04,0xfff6dd,home,x,1.76,front+.12);box(.65,.055,.04,0xfff6dd,home,x,1.76,front+.12);
      box(.95,.15,.34,0xb76f47,home,x,1.22,front+.13);
      for(let k=0;k<3;k++) sphere(.17,k%2?0xf1c358:0xf6e6b5,home,x+(k-1)*.25,1.36,front+.15);
    }
    box(.55,1,.6,0xdac9ae,home,w*.5,3.5,-.4);
    // Small stones lead to each front door; these are walkable.
    for(let n=1;n<=5;n++) {const z=h.z+h.d/2+n*.9;const stone=mesh(new THREE.CylinderGeometry(.4,.48,.06,7),0xd5caa6,scene,h.x+.15*Math.sin(n),groundHeight(h.x,z)+.02,z);stone.rotation.y=n;}
    markOccluder(home,h.x,h.z,3);
  }
  for(let i=0;i<TREES.length;i++) {
    const [x,z,s]=TREES[i],tree=new THREE.Group();tree.position.set(x,groundHeight(x,z),z);tree.scale.setScalar(s);scene.add(tree);
    mesh(new THREE.CylinderGeometry(.2,.34,3.1,7),0x9a764d,tree,0,1.55,0);
    if(i%3===0) {
      // Broad, low-poly palm fronds are actual game geometry.
      for(let j=0;j<7;j++) {const a=j/7*Math.PI*2;const leaf=sphere(1,0x398d50,tree,Math.cos(a)*1.05,3.5,Math.sin(a)*1.05);leaf.scale.set(1.8,.23,.48);leaf.rotation.y=-a;leaf.rotation.z=-.22;}
      sphere(.7,0x5aab51,tree,0,3.65,0);
    } else {
      sphere(1.65,i%2?0x459551:0x4b9b4c,tree,0,3.35,0);
      sphere(1.12,0x70b853,tree,-.58,4.15,-.25);
      sphere(.95,0x61ab4e,tree,.85,3.72,.15);
    }
    markOccluder(tree,x,z,2.1*s);
  }
  for(const [x,z,s] of ROCKS) {
    const rock=mesh(new THREE.DodecahedronGeometry(s,0),0x8b9d97,scene,x,groundHeight(x,z)+.45*s,z);rock.scale.set(1.1,.85,.9);rock.rotation.set(.15,x, .2);
    const small=mesh(new THREE.DodecahedronGeometry(s*.4,0),0xabb6a3,scene,x+s,groundHeight(x+s,z)+.2,z+.4);small.scale.y=.7;
  }
  // Instanced grass and wildflowers keep the island inexpensive to draw.
  const grassMesh=new THREE.InstancedMesh(new THREE.ConeGeometry(.09,.35,3),material(0x579b43),480);
  const flowerMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.075,0),material(0xffe7aa),200);
  const dummy=new THREE.Object3D();let grassCount=0,flowerCount=0;
  for(let n=0;n<1000&&grassCount<480;n++) {
    const x=(random()-.5)*46,z=(random()-.5)*34;
    if(Math.hypot(x/29,z/23)>.77||!canStand(x,z)||Math.abs(x)<1.4)continue;
    dummy.position.set(x,groundHeight(x,z)+.13,z);dummy.rotation.set(0,random()*6,.18);dummy.scale.setScalar(.7+random()*.6);dummy.updateMatrix();grassMesh.setMatrixAt(grassCount++,dummy.matrix);
    if(flowerCount<200&&random()>.55){dummy.position.y+=.13;dummy.scale.setScalar(1);dummy.updateMatrix();flowerMesh.setMatrixAt(flowerCount++,dummy.matrix);}
  }
  grassMesh.count=grassCount;flowerMesh.count=flowerCount;scene.add(grassMesh,flowerMesh);

  // A little beach picnic gives the starting shore a landmark.
  const blanket=box(2.5,.025,2,0xe8a080,scene,-5,groundHeight(-5,15)+.02,15);blanket.rotation.y=.25;
  for(let i=0;i<4;i++)box(.12,.028,2,0xffeac7,scene,-5.8+i*.5,groundHeight(-5,15)+.04,15);
  const umbrella=new THREE.Group();umbrella.position.set(-6.2,groundHeight(-6.2,15),15);scene.add(umbrella);
  mesh(new THREE.CylinderGeometry(.04,.04,2.4,6),0xe9d6a1,umbrella,0,1.2,0);
  mesh(new THREE.ConeGeometry(1.55,.55,10),0xf1bd62,umbrella,0,2.5,0);
  const coinObjects=COINS.map(c=>{
    const group=new THREE.Group();scene.add(group);group.position.set(c.x,groundHeight(c.x,c.z)+1,c.z);
    const disk=mesh(new THREE.CylinderGeometry(.32,.32,.105,20),0xffcf42,group);disk.rotation.x=Math.PI/2;
    const inner=mesh(new THREE.TorusGeometry(.23,.021,5,20),0xffeb87,group,0,0,.063);
    box(.055,.24,.025,0xffed9b,group,0,0,.069);group.userData.baseY=group.position.y;return group;
  });

  const player=new THREE.Group();scene.add(player);
  const body=new THREE.Group();player.add(body);
  mesh(new THREE.CapsuleGeometry(.34,.43,4,10),0xfff0d5,body,0,.94,0);
  sphere(.39,0xf4c599,body,0,1.63,0);
  mesh(new THREE.CylinderGeometry(.45,.48,.09,12),0xd66b48,body,0,1.93,0);
  const hat=mesh(new THREE.SphereGeometry(.4,12,6,0,Math.PI*2,0,Math.PI/2),0xe77e53,body,0,1.94,0);hat.scale.y=.6;
  box(.5,.1,.3,0xd66b48,body,0,1.94,.36);
  for(const x of [-.13,.13]) sphere(.047,0x334744,body,x,1.66,.35);
  box(.46,.52,.2,0x4e8d83,body,0,1.04,-.36);
  const arms=[],legs=[];
  for(const side of [-1,1]) {
    const arm=new THREE.Group();arm.position.set(side*.4,1.18,0);body.add(arm);mesh(new THREE.CapsuleGeometry(.115,.34,3,6),0xf4c599,arm,0,-.24,0);arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.18,.65,0);player.add(leg);mesh(new THREE.CapsuleGeometry(.135,.28,3,6),0x436d75,leg,0,-.23,0);box(.28,.17,.41,0xf7e3bd,leg,0,-.48,.06);legs.push(leg);
  }
  const halo=mesh(new THREE.RingGeometry(.55,.62,32),0xffe8a4,scene);halo.rotation.x=-Math.PI/2;halo.castShadow=false;
  const particles=[];const particleGeometry=new THREE.OctahedronGeometry(.075);
  function sparkle(x,z) {for(let i=0;i<9;i++){const p=mesh(particleGeometry,0xffe274,scene,x,groundHeight(x,z)+1,z);p.castShadow=false;particles.push({mesh:p,life:.7,vx:(random()-.5)*3,vy:2+random()*2,vz:(random()-.5)*3});}}
  let state=createState(),input=new Set(),animation=0,previous=0,time=0,lastRegion='',noticeUntil=0,stopped=false;
  let cameraTarget=new THREE.Vector3(SPAWN.x,.8,SPAWN.z-1.6);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const showNotice=(message,duration=3)=>{callbacks.onNotice(message);noticeUntil=time+duration;};
  function reset() {
    state=createState();input.clear();callbacks.onCoins(0);callbacks.onRegion(regionAt(state.x,state.z));
    coinObjects.forEach(c=>c.visible=true);for(const p of particles)scene.remove(p.mesh);particles.length=0;
    camera.position.set(state.x,groundHeight(state.x,state.z)+18*(camera.aspect<.85?1.22:1),state.z+22*(camera.aspect<.85?1.22:1));cameraTarget.set(state.x,.8,state.z-1.6);
    player.position.set(state.x,groundHeight(state.x,state.z),state.z);player.rotation.y=state.heading;showNotice('A fresh little adventure.',2.5);
  }
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();reset();callbacks.onNotice('');noticeUntil=0;
  const allowed=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyR']);
  const keydown=e=>{if(!allowed.has(e.code)||e.ctrlKey||e.metaKey||e.altKey)return;if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;e.preventDefault();if(e.code==='KeyR'){if(!e.repeat)reset();}else input.add(e.code);};
  const keyup=e=>input.delete(e.code);
  const blur=()=>{input.clear();state.vx=0;state.vz=0;};
  const visibility=()=>{blur();previous=0;};
  const focus=()=>renderer.domElement.focus();
  const contextLost=e=>{e.preventDefault();stopped=true;callbacks.onError('The 3D view was interrupted. Reload the island to continue.');};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);renderer.domElement.addEventListener('pointerdown',focus);renderer.domElement.addEventListener('webglcontextlost',contextLost);
  let frames=0,frameSum=0,slowFrames=0;
  function animate(now) {
    if(stopped)return;animation=requestAnimationFrame(animate);
    if(document.hidden){previous=0;return;}
    const raw=previous?(now-previous)/1000:1/60,dt=Math.min(raw,.05);previous=now;time+=dt;
    frames++;frameSum+=raw;if(raw>.035)slowFrames++;
    const result=step(state,input,dt);
    player.position.set(state.x,groundHeight(state.x,state.z),state.z);
    const turn=THREE.MathUtils.euclideanModulo(state.heading-player.rotation.y+Math.PI,Math.PI*2)-Math.PI;
    player.rotation.y+=turn*(1-Math.exp(-14*dt));
    const walking=result.moved>.002,swing=walking?Math.sin(state.steps*5.7)*.52:0;
    legs[0].rotation.x=swing;legs[1].rotation.x=-swing;arms[0].rotation.x=-swing*.8;arms[1].rotation.x=swing*.8;body.position.y=walking&&!reduced?Math.abs(Math.sin(state.steps*5.7))*.055:0;
    halo.position.set(state.x,groundHeight(state.x,state.z)+.024,state.z);
    const next=followCamera(camera.position,state,dt,camera.aspect);camera.position.set(next.x,next.y,next.z);
    cameraTarget.lerp(new THREE.Vector3(state.x,groundHeight(state.x,state.z)+.7,state.z-1.6),1-Math.exp(-5*dt));camera.lookAt(cameraTarget);
    for(const coin of coinObjects){if(!coin.visible)continue;coin.rotation.y=reduced?.4:time*1.5;coin.position.y=coin.userData.baseY+(reduced?0:Math.sin(time*2.8+coin.position.x)*.13);}
    if(result.added.length) {for(const id of result.added){coinObjects[id].visible=false;sparkle(COINS[id].x,COINS[id].z);}callbacks.onCoins(state.collected.size);if(state.collected.size===12)showNotice('All 12 found! Stay a little longer — or start again.',8);else if(state.collected.size===1)showNotice('Your first little treasure. 11 more to discover.');}
    for(let i=particles.length-1;i>=0;i--) {const p=particles[i];p.life-=dt;if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);continue;}p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.vy-=6*dt;p.mesh.scale.setScalar(p.life/.7);}
    for(const o of occluders) {const dz=o.z-state.z,hidden=dz>.2&&dz<8&&Math.abs(o.x-state.x)<o.radius;for(const m of o.mats){m.opacity+=( (hidden?.28:1)-m.opacity)*(1-Math.exp(-8*dt));m.depthWrite=m.opacity>.9;}}
    if(!reduced){foam.scale.setScalar(1+Math.sin(time*.8)*.006);foam2.material.opacity=.25+Math.sin(time*.9)*.09;for(const r of ripples)r.scale.x=.85+Math.sin(time+r.userData.phase)*.15;}
    const region=regionAt(state.x,state.z);if(region!==lastRegion){lastRegion=region;callbacks.onRegion(region);}
    if(noticeUntil&&time>noticeUntil){callbacks.onNotice('');noticeUntil=0;}
    renderer.render(scene,camera);
  }
  animation=requestAnimationFrame(animate);
  // Read-only local QA telemetry; omitted from production builds.
  if(import.meta.env.DEV) window.__islandDebug=()=>({x:state.x,z:state.z,coins:state.collected.size,camera:camera.position.toArray(),frames,averageFps:frames/frameSum,slowFrames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
  return {reset,setInput:(key,down)=>{if(down)input.add(key);else input.delete(key);},destroy:()=>{
    stopped=true;cancelAnimationFrame(animation);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('pointerdown',focus);renderer.domElement.removeEventListener('webglcontextlost',contextLost);
    const geometries=new Set(),mats=new Set();scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);if(Array.isArray(o.material))o.material.forEach(m=>mats.add(m));else mats.add(o.material);}});geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();if(import.meta.env.DEV)delete window.__islandDebug;
  }};
}

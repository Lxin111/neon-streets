import * as THREE from 'three';
import {GameAudio} from './audio.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
const readSaved=(key,fallback)=>{try{const value=localStorage.getItem(key);if(value===null)return fallback;const parsed=JSON.parse(value);if(Array.isArray(fallback)&&!Array.isArray(parsed)){console.warn('存档格式异常，使用默认值：'+key);return fallback;}if(fallback&&typeof fallback==='object'&&!Array.isArray(fallback)&&(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))){console.warn('存档格式异常，使用默认值：'+key);return fallback;}return parsed;}catch(error){console.warn('存档读取失败，使用默认值：'+key,error);return fallback;}};
const mat=(color,roughness=.55,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(g,geo,material,pos,rot){const m=new THREE.Mesh(geo,material);m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function capsule(g,r,len,material,pos){return mesh(g,new THREE.CapsuleGeometry(r,len,5,10),material,pos);}
function organicGeometry(profile,segments=32){
 const rows=[];
 for(let k=0;k<profile.length-1;k++){
  const p0=profile[Math.max(0,k-1)],p1=profile[k],p2=profile[k+1],p3=profile[Math.min(profile.length-1,k+2)];
  for(let step=0;step<4;step++){const t=step/4,t2=t*t,t3=t2*t;rows.push(p1.map((v,i)=>.5*((2*v)+(-p0[i]+p2[i])*t+(2*p0[i]-5*v+4*p2[i]-p3[i])*t2+(-p0[i]+3*v-3*p2[i]+p3[i])*t3)));}
 }
 rows.push(profile[profile.length-1]);const vertices=[],indices=[];
 for(const [y,rx,rz,cx=0,cz=0] of rows)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;vertices.push(cx+Math.cos(a)*Math.max(.001,rx),y,cz+Math.sin(a)*Math.max(.001,rz));}
 const descending=rows[rows.length-1][0]<rows[0][0];for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;if(descending)indices.push(a,a+1,b,b,a+1,b+1);else indices.push(a,b,a+1,b,b+1,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function organicMesh(parent,profile,material,pos=[0,0,0],segments=32){const m=new THREE.Mesh(organicGeometry(profile,segments),material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function makeHealthText(root,width,y){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;ctx.strokeStyle='#071018';ctx.strokeText('0/0',128,33);ctx.fillStyle='#ffffff';ctx.fillText('0/0',128,33);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.position.set(0,y+.005,.045);sprite.scale.set(width*.92,.17,1);sprite.renderOrder=20;root.add(sprite);return {sprite,canvas,ctx,texture};}
function setHealthDisplay(model,hp,maxHp,width=1.16){const ratio=THREE.MathUtils.clamp((Number(hp)||0)/Math.max(1,Number(maxHp)||1),0,1);if(model.hpFill){model.hpFill.scale.x=width*ratio;model.hpFill.position.x=-width/2+(width*ratio)/2;model.hpFill.material.color.set(ratio>.6?'#39e66b':ratio>.3?'#ff9b2f':'#ff3548');}if(model.hpText){const {ctx,canvas,texture}=model.hpText;ctx.clearRect(0,0,canvas.width,canvas.height);const label=Math.max(0,Math.ceil(Number(hp)||0))+'/'+Math.max(1,Math.ceil(Number(maxHp)||1));ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;ctx.strokeStyle='#071018';ctx.strokeText(label,128,33);ctx.fillStyle='#ffffff';ctx.fillText(label,128,33);texture.needsUpdate=true;}}
const SWORDS=[{id:'red',name:'赤焰',color:'#ff354f'},{id:'orange',name:'烈阳',color:'#ff8a28'},{id:'yellow',name:'黄金',color:'#ffe45c'},{id:'green',name:'翠岚',color:'#4dff9a'},{id:'cyan',name:'青霆',color:'#39e9ff'},{id:'purple',name:'紫电',color:'#bd70ff'}];
function makeKatana(g,color){const sword=new THREE.Group();g.add(sword);sword.position.set(.48,1.05,.02);sword.rotation.set(0,0,-.25);
 mesh(sword,new THREE.CylinderGeometry(.022,.027,.36,8),mat('#17191d',.5),[0,-.05,0],[0,0,Math.PI/2]);
 mesh(sword,new THREE.BoxGeometry(.105,.03,.03),mat('#c5a45c',.35,.75),[0,.14,0]);
 const blade=mesh(sword,new THREE.BoxGeometry(.035,.78,.018),mat('#e4edf1',.2,.9),[0,.59,0],[0,0,-.06]);blade.material.emissive=new THREE.Color(color);blade.material.emissiveIntensity=.08;
 mesh(sword,new THREE.BoxGeometry(.043,.12,.025),mat('#22252a',.45),[0,.13,0]);return sword;}
function makeCloak(root){
 const geo=new THREE.PlaneGeometry(1.02,1.38,16,24),pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),t=(1-y/1.38)/2;pos.setX(i,x*(.78+.22*t));}
 geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:'#7c1024',roughness:.82,metalness:.04,side:THREE.DoubleSide,transparent:true,opacity:.94});
 const cloak=new THREE.Mesh(geo,material);cloak.position.set(0,1.32,.39);cloak.rotation.x=.04;cloak.castShadow=true;root.add(cloak);
 const mantle=mesh(root,new THREE.BoxGeometry(1.02,.13,.38),mat('#a51e32',.62),[0,1.76,.12]);return {cloak,geo,mantle,base:Float32Array.from(pos.array)};
}
function makeFighter(scene,isEnemy=false,index=0){
 const root=new THREE.Group();scene.add(root);const skin=mat(isEnemy?'#b88769':'#bd9278'),dark=mat('#171a20'),suit=mat(['#242b32','#30343b','#24242a','#343b40'][index%4]),shirt=mat('#d8d8d2'),red=mat('#8c1724',.58);
 organicMesh(root,[[.94,.22,.2],[1.08,.34,.25],[1.3,.4,.28],[1.52,.43,.27],[1.7,.3,.22],[1.82,.18,.16]],isEnemy?suit:dark);mesh(root,new THREE.BoxGeometry(.68,.58,.16),isEnemy?suit:red,[0,1.42,-.24]);
 let cloak=null,sword=null,gun=null;
 if(!isEnemy){
  organicMesh(root,[[1.86,.13,.13],[1.94,.21,.18],[2.08,.23,.19],[2.2,.19,.17],[2.27,.11,.12]],skin);
  mesh(root,new THREE.SphereGeometry(.29,16,10,0,Math.PI*2,0,Math.PI*.52),dark,[0,2.2,-.02]);
  mesh(root,new THREE.ConeGeometry(.34,.48,12),dark,[0,2.28,-.16],[Math.PI,0,0]);
  cloak=makeCloak(root);sword=makeKatana(root,'#ff354f');
 }else{
  organicMesh(root,[[1.86,.13,.13],[1.94,.21,.18],[2.08,.23,.19],[2.2,.19,.17],[2.27,.11,.12]],skin);mesh(root,new THREE.SphereGeometry(.25,14,8,0,Math.PI*2,0,Math.PI*.45),dark,[0,2.12,-.02]);
  mesh(root,new THREE.BoxGeometry(.1,.42,.035),shirt,[0,1.43,-.34]);mesh(root,new THREE.ConeGeometry(.07,.28,4),mat('#6d1821'),[0,1.37,-.37],[Math.PI,0,0]);
 }
 const armL=organicMesh(root,[[-.34,.075,.09],[-.22,.12,.12],[-.04,.14,.13],[.16,.13,.12],[.32,.09,.085]],isEnemy?suit:dark,[-.46,1.42,0]),armR=organicMesh(root,[[-.34,.075,.09],[-.22,.12,.12],[-.04,.14,.13],[.16,.13,.12],[.32,.09,.085]],isEnemy?suit:dark,[.46,1.42,0]);
 organicMesh(root,[[-.06,.07,.075],[.02,.11,.09],[.13,.1,.08],[.2,.055,.06]],skin,[-.48,1.12,0]);organicMesh(root,[[-.06,.07,.075],[.02,.11,.09],[.13,.1,.08],[.2,.055,.06]],skin,[.48,1.12,0]);
 const armor=mat(isEnemy?'#263747':'#202c3b',.28,.78),edge=mat('#718da0',.24,.82),glowMat=new THREE.MeshStandardMaterial({color:'#6ff4ff',metalness:.35,roughness:.2,emissive:'#10cfff',emissiveIntensity:1.35});
  mesh(root,new THREE.BoxGeometry(.58,.34,.2),armor,[0,1.55,-.34]);
  mesh(root,new THREE.BoxGeometry(.48,.09,.22),edge,[0,1.76,-.34]);
  const reactor=mesh(root,new THREE.OctahedronGeometry(.105,1),glowMat,[0,1.53,-.47]);reactor.rotation.z=Math.PI/4;
  mesh(root,new THREE.BoxGeometry(.1,.48,.08),edge,[-.34,1.42,-.23],[0,0,-.08]);
  mesh(root,new THREE.BoxGeometry(.1,.48,.08),edge,[.34,1.42,-.23],[0,0,.08]);
  const shoulderL=mesh(root,new THREE.SphereGeometry(.2,12,10),armor,[-.47,1.67,-.02]);shoulderL.scale.set(1.15,.78,1.05);
  const shoulderR=mesh(root,new THREE.SphereGeometry(.2,12,10),armor,[.47,1.67,-.02]);shoulderR.scale.set(1.15,.78,1.05);
  mesh(root,new THREE.BoxGeometry(.42,.09,.12),glowMat,[0,1.17,-.29]);
  const legL=organicMesh(root,[[-.28,.105,.12],[-.14,.14,.14],[.06,.16,.15],[.27,.14,.13],[.48,.1,.1]],mat('#111b28',.3,.72),[-.2,.48,0]),legR=organicMesh(root,[[-.28,.105,.12],[-.14,.14,.14],[.06,.16,.15],[.27,.14,.13],[.48,.1,.1]],mat('#111b28',.3,.72),[.2,.48,0]);
  for(const x of [-.2,.2]){
    mesh(root,new THREE.BoxGeometry(.31,.2,.5),armor,[x,.14,-.08]);
    mesh(root,new THREE.BoxGeometry(.28,.055,.47),edge,[x,.22,-.08]);
    mesh(root,new THREE.BoxGeometry(.31,.06,.08),glowMat,[x,.28,-.29]);
    mesh(root,new THREE.BoxGeometry(.32,.075,.18),armor,[x,.55,-.11]);
  }
  for(const x of [-.48,.48])mesh(root,new THREE.BoxGeometry(.23,.16,.2),armor,[x,1.05,-.03]);
  mesh(root,new THREE.BoxGeometry(.34,.105,.045),mat('#101c29',.18,.8),[0,2.04,-.225]);
  mesh(root,new THREE.BoxGeometry(.105,.025,.025),glowMat,[-.075,2.045,-.255]);
  mesh(root,new THREE.BoxGeometry(.105,.025,.025),glowMat,[.075,2.045,-.255]);
 mesh(root,new THREE.BoxGeometry(.29,.14,.44),dark,[-.2,.12,-.03]);mesh(root,new THREE.BoxGeometry(.29,.14,.44),dark,[.2,.12,-.03]);
 const hpBack=new THREE.Sprite(new THREE.SpriteMaterial({color:'#101820',depthTest:false}));hpBack.position.set(0,2.72,0);hpBack.scale.set(1.22,.14,1);hpBack.renderOrder=18;root.add(hpBack);const hpFill=new THREE.Sprite(new THREE.SpriteMaterial({color:'#39e66b',depthTest:false}));hpFill.position.set(0,2.72,.012);hpFill.scale.set(1.16,.085,1);hpFill.renderOrder=19;root.add(hpFill);const hpText=makeHealthText(root,1.16,2.72);
 if(isEnemy){gun=new THREE.Group();root.add(gun);gun.position.set(.48,1.08,-.18);mesh(gun,new THREE.BoxGeometry(.12,.14,.48),mat('#24282c',.35,.7),[0,0,-.18]);mesh(gun,new THREE.BoxGeometry(.07,.18,.12),mat('#16191d'),[0,-.12,-.08]);}
 return {root,armL,armR,legL,legR,sword,gun,cloak,hpFill,hpText,anim:0,isEnemy};
}

function proceduralTexture(base,kind='fabric',seed=1){
 const size=kind==='skin'?1024:512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,size,size);
 let n=(seed>>>0)||1;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
 const image=ctx.getImageData(0,0,size,size),d=image.data;for(let i=0;i<d.length;i+=4){const v=(rand()-.5)*(kind==='skin'?22:kind==='stone'?38:18);d[i]=THREE.MathUtils.clamp(d[i]+v,0,255);d[i+1]=THREE.MathUtils.clamp(d[i+1]+v,0,255);d[i+2]=THREE.MathUtils.clamp(d[i+2]+v,0,255);}ctx.putImageData(image,0,0);
 if(kind==='fabric'){ctx.globalAlpha=.13;ctx.strokeStyle='#fff';for(let y=0;y<256;y+=4){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}ctx.globalAlpha=1;}
 if(kind==='skin'){ctx.globalAlpha=.11;for(let i=0;i<18000;i++){ctx.fillStyle=rand()>.52?'#d5efbd':'#183d20';ctx.beginPath();ctx.ellipse(rand()*size,rand()*size,.35+rand()*1.5,.45+rand()*2,rand()*Math.PI,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=.08;for(let i=0;i<260;i++){const x=rand()*size,y=rand()*size;ctx.strokeStyle=rand()>.5?'#b7d98c':'#173b1e';ctx.lineWidth=.5+rand()*1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+rand()*12,y+rand()*5,x-rand()*12,y+rand()*12,x+(rand()-.5)*20,y+(rand()-.5)*16);ctx.stroke();}ctx.globalAlpha=1;}
 if(kind==='stone'){ctx.globalAlpha=.35;ctx.strokeStyle='#15191c';for(let i=0;i<48;i++){const x=rand()*256,y=rand()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*38,y+(rand()-.5)*48);ctx.stroke();}ctx.globalAlpha=1;}
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;return tex;
}
function texturedMat(color,kind,seed,roughness=.72,metalness=0){const map=proceduralTexture(color,kind,seed),bump=kind==='skin'?map.clone():null;if(bump){bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;}return new THREE.MeshStandardMaterial({color,map,bumpMap:bump,bumpScale:kind==='skin'?.018:.025,roughness,metalness});}
function makeEliteSuit(scene,seed=0){
 const root=new THREE.Group();scene.add(root);const skin=texturedMat('#bd8e70','skin',seed+1,.82),suit=texturedMat(seed%2?'#252b35':'#171d27','fabric',seed+2,.88),pants=texturedMat('#171d27','fabric',seed+3,.9),shirt=texturedMat('#e4e5df','fabric',seed+4,.78),tie=mat(seed%2?'#6d1e2c':'#263f66',.72),shoe=mat('#111318',.3,.12),gold=mat('#b89a5b',.3,.72);
 const part=(geo,material,pos,scale,rot)=>{const m=new THREE.Mesh(geo,material);m.position.set(...pos);if(scale)m.scale.set(...scale);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 part(organicGeometry([[-.48,.18,.15],[-.33,.32,.23],[-.08,.42,.29],[.17,.46,.3],[.38,.32,.23],[.52,.18,.15]],32),suit,[0,1.38,0],[1,.95,.72]);part(new THREE.BoxGeometry(.54,.62,.12),shirt,[0,1.43,-.28]);part(new THREE.BoxGeometry(.12,.58,.045),tie,[0,1.4,-.36]);
 for(const side of [-1,1])part(new THREE.BoxGeometry(.18,.62,.055),suit,[side*.17,1.45,-.35],[1,1,1],[0,0,side*.22]);
 part(organicGeometry([[1.9,.13,.13],[2.0,.2,.17],[2.15,.23,.19],[2.3,.18,.15],[2.38,.1,.1]],32),skin,[0,0,-.01],[.9,1.05,.9]);part(new THREE.SphereGeometry(.25,24,16,0,Math.PI*2,0,Math.PI*.45),mat('#25201d',.9),[0,2.18,.015],[1,1,.9]);part(new THREE.BoxGeometry(.32,.065,.075),skin,[0,1.99,-.22]);
 const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(-.43,1.62,0);armR.position.set(.43,1.62,0);root.add(armL,armR);
 for(const [g,side] of [[armL,-1],[armR,1]]){const upper=new THREE.Mesh(organicGeometry([[-.48,.07,.075],[-.36,.12,.11],[-.18,.14,.12],[0,.12,.1],[.12,.08,.075]],24),suit);upper.position.y=-.23;g.add(upper);const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.09,12),shirt);cuff.position.y=-.46;g.add(cuff);const hand=new THREE.Mesh(new THREE.SphereGeometry(.105,16,12),skin);hand.position.y=-.57;g.add(hand);part(new THREE.SphereGeometry(.035,12,10),mat('#1c1715'),[side*.09,2.08,-.225]);}
 const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-.2,.58,0);legR.position.set(.2,.58,0);root.add(legL,legR);
 for(const g of [legL,legR]){const thigh=new THREE.Mesh(organicGeometry([[-.58,.09,.1],[-.44,.14,.14],[-.22,.17,.16],[0,.15,.14],[.12,.1,.1]],24),pants);thigh.position.y=-.25;g.add(thigh);const boot=new THREE.Mesh(new THREE.BoxGeometry(.3,.16,.48),shoe);boot.position.set(0,-.55,-.08);g.add(boot);}
 const hpBack=new THREE.Sprite(new THREE.SpriteMaterial({color:'#101820',depthTest:false}));hpBack.position.set(0,3.05,0);hpBack.scale.set(1.35,.15,1);hpBack.renderOrder=18;root.add(hpBack);const hpFill=new THREE.Sprite(new THREE.SpriteMaterial({color:'#39e66b',depthTest:false}));hpFill.position.set(0,3.05,.012);hpFill.scale.set(1.28,.09,1);hpFill.renderOrder=19;root.add(hpFill);const hpText=makeHealthText(root,1.28,3.05);
 return {root,armL,armR,legL,legR,hpFill,hpText,anim:0,isEnemy:true,eliteVisual:true};
}
function makeHulkBoss(scene){
 const root=new THREE.Group();scene.add(root);
 const skin=texturedMat('#4e963c','skin',91,.7),light=texturedMat('#70b65a','skin',92,.64),shadow=mat('#28552a',.88),shorts=texturedMat('#35264b','fabric',93,.88),hair=mat('#25231f',.95),eye=mat('#f0e5c8',.35),crease=mat('#244b25',.95);
 for(const material of [skin,light,shadow,shorts,hair,eye,crease]){material.side=THREE.DoubleSide;material.needsUpdate=true;}
 // Sculpted loft meshes: continuous changing cross-sections replace the old stack of primitive balls.
 const loft=(profile,material,segments=40)=>{const g=organicGeometry(profile,segments);g.computeBoundingBox();g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.visible=true;return m;};
 const add=(mesh,parent=root,pos=[0,0,0],rot=null)=>{mesh.position.set(...pos);if(rot)mesh.rotation.set(...rot);parent.add(mesh);return mesh;};
 const shape=(profile,material,parent,pos,rot)=>add(loft(profile,material),parent,pos,rot);
 // Wide trapezius, deep chest, narrow waist and powerful pelvis form one connected torso.
 shape([[.86,.34,.25],[1.02,.48,.31],[1.2,.51,.32],[1.38,.62,.36],[1.58,.78,.39],[1.78,.84,.4],[1.94,.72,.34],[2.08,.43,.27],[2.16,.27,.22]],skin,root);
 // Defined pectoral planes and abdominal plates are shallow sculpted surfaces, not spherical chunks.
 for(const side of [-1,1]){
  shape([[1.58,.025,.035,side*.04,-.365],[1.65,.18,.065,side*.24,-.355],[1.78,.22,.075,side*.25,-.35],[1.88,.13,.05,side*.2,-.33],[1.91,.02,.02,side*.12,-.32]],light,root);
  for(let row=0;row<3;row++)shape([[1.16-row*.14,.015,.018,side*.025,-.323],[1.2-row*.14,.105,.035,side*.14,-.315],[1.23-row*.14,.015,.018,side*.26,-.3]],row===1?light:skin,root);
  shape([[1.83,.02,.04,side*.57,-.02],[1.92,.18,.12,side*.67,-.01],[2.02,.24,.17,side*.68,0],[2.1,.1,.1,side*.57,0]],skin,root);
 }
 // Neck and head with a square jaw, heavy brow, cheek planes and visible ears.
 shape([[1.98,.2,.2],[2.12,.23,.22],[2.27,.22,.2]],skin,root);
 shape([[2.18,.17,.16],[2.23,.25,.21],[2.38,.29,.24],[2.57,.27,.23],[2.7,.18,.17],[2.74,.08,.1]],light,root);
 shape([[2.2,.16,.07,0,-.17],[2.27,.24,.055,0,-.19],[2.34,.21,.045,0,-.2]],skin,root);
 for(const side of [-1,1]){
  shape([[2.42,.035,.045,side*.115,-.205],[2.47,.13,.075,side*.125,-.205],[2.52,.17,.075,side*.12,-.18]],hair,root);
  const eyeSocket=new THREE.Mesh(new THREE.SphereGeometry(.075,20,14),shadow);eyeSocket.scale.set(1.25,.62,.42);add(eyeSocket,root,[side*.12,2.445,-.229]);
  const eyeMesh=new THREE.Mesh(new THREE.SphereGeometry(.047,20,14),eye);eyeMesh.scale.set(1.25,.72,.45);add(eyeMesh,root,[side*.12,2.445,-.254]);
  const iris=new THREE.Mesh(new THREE.SphereGeometry(.021,16,12),mat('#6c8a48',.32));add(iris,root,[side*.12,2.444,-.273]);
  const pupil=new THREE.Mesh(new THREE.SphereGeometry(.011,12,10),mat('#10140e',.2));add(pupil,root,[side*.12,2.444,-.284]);
  shape([[2.34,.018,.025,side*.25,-.01],[2.43,.07,.07,side*.29,0],[2.51,.025,.035,side*.26,0]],skin,root);
  shape([[2.27,.025,.035,side*.23,-.17],[2.32,.065,.055,side*.27,-.13],[2.37,.035,.035,side*.25,-.1]],skin,root);
  const ear=new THREE.Mesh(new THREE.SphereGeometry(.085,18,14),skin);ear.scale.set(.65,1.15,.55);add(ear,root,[side*.285,2.37,-.005]);
  const nostril=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),shadow);nostril.scale.set(1,.55,.6);add(nostril,root,[side*.045,2.31,-.264]);
 }
 shape([[2.49,.02,.025,0,-.22],[2.4,.045,.045,0,-.245],[2.35,.07,.055,0,-.23]],light,root);
 shape([[2.2,.03,.025],[2.22,.11,.045],[2.24,.13,.04]],shadow,root);
 shape([[2.285,.018,.018],[2.295,.095,.028],[2.305,.12,.025]],shadow,root);
 shape([[2.26,.018,.018],[2.27,.075,.025],[2.28,.09,.02]],light,root);
 // Short dark messy hair cap and side locks.
 shape([[2.58,.25,.21],[2.67,.29,.24],[2.75,.24,.2],[2.79,.12,.13]],hair,root);
 for(const side of [-1,1]){shape([[2.48,.035,.05,side*.25,0],[2.58,.07,.08,side*.26,0],[2.66,.035,.05,side*.23,0]],hair,root);const lock=new THREE.Mesh(new THREE.ConeGeometry(.075,.22,7),hair);add(lock,root,[side*.19,2.7,-.12],[0,0,side*.45]);}
 // Purple torn shorts with a shaped waistband and separate leg openings.
 shape([[.43,.34,.27],[.5,.48,.32],[.72,.5,.32],[.88,.43,.29],[.94,.36,.26]],shorts,root);
 shape([[.87,.38,.275],[.9,.4,.29],[.94,.36,.27]],shadow,root);
 // Thick arms: broad deltoids taper into forearms and oversized fists; pivots remain animation-compatible.
 const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(-.79,1.82,0);armR.position.set(.79,1.82,0);root.add(armL,armR);
 for(const [g,side] of [[armL,-1],[armR,1]]){
  shape([[ -.04,.19,.2,0,0],[-.2,.25,.22,side*.03,0],[-.43,.22,.2,side*.06,0],[-.62,.17,.16,side*.1,0],[-.78,.19,.17,side*.13,0],[-.98,.16,.15,side*.16,0],[-1.1,.13,.13,side*.17,0]],skin,g);
  shape([[-1.04,.13,.14,side*.17,0],[-1.17,.19,.16,side*.18,-.01],[-1.34,.17,.14,side*.19,-.02],[-1.43,.1,.1,side*.19,-.02]],light,g);
  shape([[-1.35,.13,.13,side*.19,-.05],[-1.48,.19,.15,side*.2,-.07],[-1.62,.16,.13,side*.2,-.08]],skin,g);
  for(let finger=0;finger<4;finger++){const knuckle=new THREE.Mesh(new THREE.BoxGeometry(.065,.12,.09),light);add(knuckle,g,[side*(.1+finger*.065),-1.59,-.19]);}
 }
 // Heavy thighs, knees, calves and broad feet with planted proportions.
 const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-.29,.56,0);legR.position.set(.29,.56,0);root.add(legL,legR);
 for(const g of [legL,legR]){
  shape([[.02,.2,.22],[ -.16,.25,.24],[ -.38,.23,.22],[ -.56,.17,.18],[ -.68,.17,.17],[ -.83,.19,.18],[ -.98,.15,.15]],skin,g);
  shape([[-.94,.15,.15],[-1.08,.17,.16],[-1.23,.14,.14],[-1.31,.12,.12]],light,g);
  shape([[-1.27,.12,.12],[-1.36,.16,.14],[-1.43,.2,.17]],skin,g);
  const foot=new THREE.Mesh(new THREE.BoxGeometry(.38,.2,.58),skin);add(foot,g,[0,-1.48,-.13]);
 }
 root.traverse(o=>{if(o.isMesh){o.visible=true;o.frustumCulled=false;o.material.side=THREE.DoubleSide;o.material.needsUpdate=true;o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}});root.visible=true;return {root,armL,armR,legL,legR,anim:0,isEnemy:true,bossVisual:'hulk'};
}
function makeOtherBoss(scene,type){
 const root=new THREE.Group();scene.add(root);const stone=type===2,base=stone?texturedMat('#667b89','stone',202,.94,.18):texturedMat('#211c2e','fabric',303,.68,.55),trim=mat(stone?'#a8c2ce':'#9a55d9',.28,.82),glow=new THREE.MeshStandardMaterial({color:stone?'#6bcfff':'#bd68ff',emissive:stone?'#2589c8':'#7b24d1',emissiveIntensity:1.8,metalness:.4,roughness:.2});
 const part=(geo,material,pos,scale,rot)=>{const m=new THREE.Mesh(geo,material);m.position.set(...pos);if(scale)m.scale.set(...scale);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 part(organicGeometry(stone?[[.68,.3,.28],[.9,.48,.4],[1.3,.65,.52],[1.7,.68,.52],[1.98,.42,.35],[2.12,.2,.2]]:[[.82,.22,.2],[1.02,.34,.28],[1.35,.44,.34],[1.7,.38,.3],[1.94,.22,.2]],32),base,[0,0,0],[stone?1.25:1,1,stone?1.05:.85]);part(organicGeometry([[2.25,.14,.13],[2.35,.24,.2],[2.5,stone?.39:.28,stone?.34:.25],[2.68,stone?.32:.22],[2.76,.12,.12]],32),base,[0,0,-.02],[1,1.1,.9]);
 if(stone){for(const side of [-1,1]){part(new THREE.DodecahedronGeometry(.52),base,[side*.68,1.55,0],[1.15,1.1,1]);part(new THREE.BoxGeometry(.26,.72,.25),trim,[side*.76,.9,-.02]);part(new THREE.BoxGeometry(.28,.25,.3),base,[side*.24,.36,0]);}part(new THREE.BoxGeometry(.7,.14,.12),trim,[0,2.48,-.28]);}
 else{part(new THREE.ConeGeometry(.48,.9,8),base,[0,2.9,.12]);for(const side of [-1,1]){part(new THREE.ConeGeometry(.18,.85,8),trim,[side*.52,1.8,.02],[1,1,1],[0,0,-side*.65]);part(new THREE.BoxGeometry(.08,.62,.1),glow,[side*.19,1.42,-.32]);}part(new THREE.TorusGeometry(.72,.055,10,32),glow,[0,1.2,0],[1,1,1],[Math.PI/2,0,0]);}
 const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(-.52,1.72,0);armR.position.set(.52,1.72,0);root.add(armL,armR);
 for(const [g,side] of [[armL,-1],[armR,1]]){const arm=new THREE.Mesh(organicGeometry([[-.82,.1,.1],[-.66,stone?.23:.15,stone?.2:.13],[-.4,stone?.25:.16,stone?.22:.14],[-.16,stone?.18:.12,stone?.16:.1],[.02,.12,.11]],28),base);arm.position.set(side*.08,-.38,0);arm.castShadow=true;g.add(arm);const hand=new THREE.Mesh(new THREE.DodecahedronGeometry(.24),trim);hand.position.set(side*.12,-.83,0);g.add(hand);}
 const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-.22,.65,0);legR.position.set(.22,.65,0);root.add(legL,legR);
 for(const g of [legL,legR]){const leg=new THREE.Mesh(organicGeometry([[-.68,.11,.12],[-.5,.2,.18],[-.28,.23,.2],[-.06,.18,.17],[.12,.12,.12]],28),base);leg.position.y=-.32;g.add(leg);}
 return {root,armL,armR,legL,legR,anim:0,isEnemy:true,bossVisual:stone?'stone-colossus':'void-reaper'};
}

export class FighterGame{
 constructor(world){
  this.world=world;this.scene=world.scene;this.camera=world.camera;this.renderer=world.renderer;this.audio=new GameAudio();
  this.player={root:new THREE.Group()};this.player.root.visible=false;this.scene.add(this.player.root);this.districtNumber=1;this.encounterActive=true;this.encounterCleared=false;this.coreSlots=Array(10).fill(null);this.cores=[];this.coreInventory=[];this.poisonTime=0;this.attackSpeedBonus=0;this.moveBonus=0;this.critBonus=0;this.critDamageBonus=0;this.shopSpeedBonus=0;this.shopCritBonus=0;this.shopCritDmgBonus=0;this.shopHpBonus=0;this.shopCategories=['恢复补给','近战强化','枪械强化','防御装备','战术道具'];this.shopItems=(()=>{const catalog=[
['恢复补给',['纳米止血针','战地医疗包','高压凝血剂','细胞修复液','肾上腺素针','急救喷雾','抗毒血清','再生凝胶','生命维持剂','医疗无人机','强化血浆','应急心脏泵','纳米绷带','快速愈合剂','战术口粮','净化注射器','深层修复舱','生命虹吸器','复苏药剂','凤凰急救包'],'heal'],
['近战强化',['钨钢刀芯','振动刃口','合金刀脊','重斩配重','高速轴承','裂甲磨刃','电弧刀环','共振握柄','钛合金护手','连击稳定器','热等离子刃','锋刃校准器','斩击增幅器','刀锋导流槽','破盾刀尖','磁力刀鞘','相位切割器','超频刀柄','处决模块','剑气聚焦器'],'melee'],
['枪械强化',['轻量化枪机','高压弹簧','钨芯弹匣','枪口制退器','智能瞄准镜','脉冲扳机','稳定握把','穿甲弹头','快速换弹器','扩容弹匣','热成像模块','枪管冷却器','后坐补偿器','电磁加速器','连发控制器','弹道计算芯片','消音组件','高能弹药包','精准校准器','战术枪托'],'gun'],
['防御装备',['陶瓷复合胸甲','碳纤维护膝','液压外骨骼','纳米纤维护臂','冲击吸收层','钛合金头盔','能量护盾片','防弹战术衣','强化脊柱架','抗震战靴','自动止损模块','偏转装甲板','应急护盾发生器','高密度护肩','生物陶瓷内衬','热能隔离层','微型维修蜂群','护甲锁定系统','冲击分散器','重型外骨骼'],'defense'],
['战术道具',['侦察无人机','诱饵投影器','电磁脉冲雷','震撼弹','烟幕发生器','追踪标记器','战场扫描仪','短距跃迁器','战术照明棒','干扰信标','自动炮台','声波诱导器','冷却喷射器','能量电池','快速部署绳索','区域扫描脉冲','时间缓滞器','磁力陷阱','战术补给箱','空投支援模块'],'tactical']
];let items=[];catalog.forEach(([,names,kind],ci)=>names.forEach((name,i)=>items.push({id:'goods_'+(ci*20+i+1),name,category:this.shopCategories[ci],desc:['战场即时补给与恢复','永久提升近战输出能力','强化枪械伤害与操控','提高生存能力与承伤上限','提供特殊战术与战场控制'][ci]+' · 等级 '+(1+Math.floor(i/4)),price:25+ci*12+i*9,kind,tier:1+Math.floor(i/4),index:i})));return items;})();
  this.enemies=[];this.realisticAsset=null;this.realisticAssetError=null;this.bullets=[];this.waves=[];this.particles=[];
  this.keys={};this.mobile={x:0,y:0};const savedLevel=Number(localStorage.getItem('ns_level')||1);this.level=Number.isFinite(savedLevel)?THREE.MathUtils.clamp(Math.floor(savedLevel),1,9999):1;const savedXp=Number(localStorage.getItem('ns_xp')||0);this.xp=Number.isFinite(savedXp)?THREE.MathUtils.clamp(savedXp,0,99):0;this.attackMultiplier=Math.pow(1.02,this.level-1);this.baseAttack=Math.round(15*this.attackMultiplier);this.maxHp=100+5*(this.level-1);this.hp=this.maxHp;this.skillPoints=0;this.unlockedSkills=[];this.bestiarySeen=[];this.storyClaims=[];this.bountyClaims=[];this.questState=null;this.block=false;this.attackTime=0;this.iaidoTime=0;this.dodgeTime=0;this.invuln=0;this.combo=0;this.comboWindow=0;this.parryWindow=0;this.buff=null;this.buffTime=0;
  this.swordCharge=0;this.swordColor='#e7edf2';this.swordId='starter';this.gold=Number(localStorage.getItem('ns_gold')||0);this.kills=Number(localStorage.getItem('ns_kills')||0);this.achievements=readSaved('ns_achievements',[]);this.achievementRecords=readSaved('ns_achievement_records',[]);this.bestCombo=Number(localStorage.getItem('ns_best_combo')||0);this.ownedSwords=readSaved('ns_owned_swords',[]);this.weaponOwned=readSaved('ns_weapon_owned',{solar:false,demon:false,ak:false});this.activeWeapon='katana';this.weaponVisual=null;this.districtProgress=0;this.lastDistrictMark=0;this.bossActive=false;this.bossCount=0;this.timeStop=0;this.chest=null;this.onWeaponChest=null;this.onStatsToggle=null;this.onWeaponChange=null;this.savedSword=localStorage.getItem('ns_sword');this.eliteKills=Number(localStorage.getItem('ns_elite_kills')||0);this.bossKills=Number(localStorage.getItem('ns_boss_kills')||0);this.shopPurchases=Number(localStorage.getItem('ns_shop_purchases')||0);this.attackCount=Number(localStorage.getItem('ns_attack_count')||0);
  this.mouseSensitivity=Number(localStorage.getItem('ns_sensitivity')||1);this.paused=false;this.started=false;this.clock=new THREE.Clock();this.lastUpdate=0;this.cameraYaw=0;this.cameraPitch=.04;this.cameraDistance=0;this.pointerLocked=false;this.dodgeDir=new THREE.Vector3(0,0,-1);this.gameOver=false;this.loadCampaignSave();this.initQuests();this.bind();this.initEnemyIndicators();this.initMinimap();
 }
 async initializeFirstEncounter(onProgress=()=>{}){
  // Defer expensive scene construction until after the loading screen can paint.
  const yieldFrame=()=>new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve();};if(typeof requestAnimationFrame==='function')requestAnimationFrame(finish);setTimeout(finish,120);});
  onProgress(0.05,'正在创建玩家模型…');await yieldFrame();
  this.scene.remove(this.player.root);this.player=makeFighter(this.scene,false);this.player.root.position.set(0,0,5);this.player.root.rotation.y=Math.PI;this.player.root.visible=false;
  onProgress(0.2,'正在创建第一人称武器…');await yieldFrame();
  this.createFirstPersonWeapon();if(this.savedSword&&this.ownedSwords.includes(this.savedSword))this.equipSword(this.savedSword);if(this.activeWeapon!=='katana'&&this.weaponOwned[this.activeWeapon])this.switchWeapon(this.activeWeapon);await yieldFrame();
  onProgress(0.3,'正在准备初始敌人…');
  this.enemies=[];this.bullets=[];this.waves=[];this.bossActive=false;
  const n=(this.districtNumber-1)%6+1;
  if(n<=3){
   const total=5+n;
   for(let done=0;done<total;){
    const batch=Math.min(2,total-done);
    this.spawnWave(batch,done,total);done+=batch;onProgress(0.3+done/total*0.7);
    await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve();};if(typeof requestAnimationFrame==='function')requestAnimationFrame(finish);setTimeout(finish,120);});
   }
   this.encounterActive=true;this.encounterCleared=false;
   this.onAdvance?.({show:false,district:this.districtNumber});this.onDistrict?.(this.districtNumber);this.updateUI();
  }else{
   this.spawnEncounter();onProgress(1);
  }
 }
 isEnemySpawnBlocked(x,z,radius=.48){const colliders=this.world.buildingColliders||[],segments=this.citySegments||[{z:0}];for(const seg of segments)for(const c of colliders){const cz=z-(seg.z||0);if(c.type==='circle'){const dx=x-c.x,dz=cz-c.z;if(dx*dx+dz*dz<(c.r+radius)*(c.r+radius))return true;}else if(x>c.minX-radius&&x<c.maxX+radius&&cz>c.minZ-radius&&cz<c.maxZ+radius)return true;}for(const e of this.enemies){if(e.dead||!e.model?.root)continue;const dx=x-e.model.root.position.x,dz=z-e.model.root.position.z,spacing=radius+((e.boss||e.elite)?1.15:.65);if(dx*dx+dz*dz<spacing*spacing)return true;}return false;}
 findEnemySpawnPoint(index,total,radius=.48){const p=this.player.root.position,forward=new THREE.Vector3(Math.sin(this.cameraYaw),0,-Math.cos(this.cameraYaw)),right=new THREE.Vector3(Math.cos(this.cameraYaw),0,Math.sin(this.cameraYaw));const columns=Math.min(4,Math.max(1,total)),row=Math.floor(index/columns),col=index%columns,lateral=(col-(columns-1)/2)*2.35;for(let attempt=0;attempt<48;attempt++){const ring=Math.floor(attempt/12),slot=attempt%12,sideOffset=lateral+((slot%5)-2)*1.35,depth=9+row*4.5+ring*3.2+Math.floor(slot/5)*1.6,candidate=p.clone().addScaledVector(forward,depth).addScaledVector(right,sideOffset);if(!this.isEnemySpawnBlocked(candidate.x,candidate.z,radius))return candidate;}for(let depth=12;depth<=48;depth+=4)for(const side of [0,-4,4,-8,8,-12,12]){const candidate=p.clone().addScaledVector(forward,depth).addScaledVector(right,side);if(!this.isEnemySpawnBlocked(candidate.x,candidate.z,radius))return candidate;}return p.clone().addScaledVector(forward,55+row*4).addScaledVector(right,lateral);}
 spawnWave(n,spawnOffset=0,formationTotal=n){const start=this.enemies.length,cycle=Math.floor((this.districtNumber-1)/6),scale=1+cycle*.22;for(let i=0;i<n;i++){const idx=start+i,formationIndex=spawnOffset+i,model=makeFighter(this.scene,true,idx),spawn=this.findEnemySpawnPoint(formationIndex,formationTotal);model.root.position.copy(spawn);const toPlayer=this.player.root.position.clone().sub(spawn);model.root.rotation.y=Math.atan2(-toPlayer.x,-toPlayer.z);const hp=(idx%5===4?80:65)*scale;setHealthDisplay(model,hp,hp);const enemy={model,hp,maxHp:hp,attack:(1+Math.random())*(1+cycle*.12),damage:8*(1+cycle*.12),stun:0,dead:false,seed:idx,ranged:idx%5===4,spawnIndex:formationIndex,lastMoveAt:performance.now(),navSide:formationIndex%2?1:-1};this.enemies.push(enemy);if(this.realisticAsset)this.attachRealisticModel(enemy);}}
 loadRealisticEnemyModel(onProgress=()=>{}){
  const url=`${import.meta.env.BASE_URL}models/nathan-photogrammetry.glb`;
  return new Promise(resolve=>{
   let settled=false;const finish=value=>{if(settled)return;settled=true;resolve(value);};
   try{
    new GLTFLoader().load(url,gltf=>{
     try{
      this.realisticAsset=gltf;this.realisticAssetKind='renderpeople-scan';
      const enemies=this.enemies.filter(enemy=>!enemy.dead&&!enemy.elite&&!enemy.boss);
      for(let i=0;i<enemies.length;i++){
       try{this.attachRealisticModel(enemies[i]);}
       catch(error){console.warn('真人扫描角色应用失败，保留基础模型。',error);this.realisticAssetError=error;}
       if(i%2===1){onProgress((i+1)/Math.max(1,enemies.length));}
      }
      finish(true);
     }catch(error){this.realisticAssetError=error;console.warn('真人扫描模型处理失败，使用基础角色。',error);finish(false);}
    },event=>{if(event.lengthComputable)onProgress(event.loaded/event.total);},error=>{this.realisticAssetError=error;console.warn('真人扫描模型加载失败，继续使用基础角色。',error);finish(false);});
   }catch(error){this.realisticAssetError=error;console.warn('真人扫描模型初始化失败，继续使用基础角色。',error);finish(false);}
  });
 }
 attachRealisticModel(enemy){
  if(!enemy||enemy.elite||enemy.boss||!this.realisticAsset||enemy.model.visualRoot)return;
  const rig=enemy.model,visual=cloneSkeleton(this.realisticAsset.scene);
  // Normalize only after resetting the cloned scene root scale. The old code
  // measured height before this reset, which could produce an enormous scale
  // (or a nearly invisible model) when the GLB root carried a non-unit scale.
  visual.scale.set(1,1,1);visual.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(visual),size=box.getSize(new THREE.Vector3()),height=size.y;
  if(!Number.isFinite(height)||height<0.25||height>20)throw new Error('真人扫描模型尺寸异常：'+height);
  visual.position.x-=(box.min.x+box.max.x)*.5;visual.position.y-=box.min.y;visual.position.z-=(box.min.z+box.max.z)*.5;
  const group=new THREE.Group();group.rotation.y=Math.PI;group.add(visual);group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const armorMat=mat(['#1b2832','#25252d','#26343b','#34252d'][enemy.seed%4],.3,.78),edgeMat=mat('#8799a8',.24,.82),glowMat=new THREE.MeshStandardMaterial({color:'#6ff4ff',metalness:.35,roughness:.2,emissive:'#10cfff',emissiveIntensity:1.25});
  mesh(group,new THREE.BoxGeometry(.57,.38,.16),armorMat,[0,1.34,-.31]);mesh(group,new THREE.BoxGeometry(.46,.055,.18),edgeMat,[0,1.55,-.33]);mesh(group,new THREE.OctahedronGeometry(.075,1),glowMat,[0,1.34,-.41]);mesh(group,new THREE.BoxGeometry(.34,.42,.2),armorMat,[0,1.42,.24]);
  group.scale.setScalar(2.05/height);
  for(const side of [-1,1]){const shoulder=mesh(group,new THREE.SphereGeometry(.16,12,10),armorMat,[side*.36,1.56,-.2]);shoulder.scale.set(1.15,.78,1);mesh(group,new THREE.BoxGeometry(.13,.3,.13),edgeMat,[side*.42,1.17,-.18],[0,0,side*.08]);mesh(group,new THREE.BoxGeometry(.24,.14,.22),armorMat,[side*.16,.57,-.2]);}
  rig.root.traverse(o=>{if(o.isMesh)o.visible=false;});rig.root.add(group);rig.visualRoot=group;
  rig.mixer=new THREE.AnimationMixer(group);rig.actions={};
  const bonePrefix='rp_nathan_animated_003_walking_';rig.bones={upperarmR:group.getObjectByName(bonePrefix+'upperarm_r'),lowerarmR:group.getObjectByName(bonePrefix+'lowerarm_r'),upperarmL:group.getObjectByName(bonePrefix+'upperarm_l'),lowerarmL:group.getObjectByName(bonePrefix+'lowerarm_l'),upperlegR:group.getObjectByName(bonePrefix+'upperleg_r'),lowerlegR:group.getObjectByName(bonePrefix+'lowerleg_r')};
  const hand=group.getObjectByName(bonePrefix+'hand_r');if(hand){const weapon=new THREE.Group();weapon.position.set(.015,-.025,-.055);weapon.rotation.set(-.2,0,Math.PI/2);if(enemy.ranged){mesh(weapon,new THREE.BoxGeometry(.075,.12,.32),mat('#202a33',.3,.85),[0,0,-.1]);mesh(weapon,new THREE.BoxGeometry(.035,.045,.22),glowMat,[0,.06,-.12]);mesh(weapon,new THREE.BoxGeometry(.06,.11,.07),mat('#101820',.35,.65),[0,-.1,-.04]);}else{mesh(weapon,new THREE.BoxGeometry(.18,.13,.16),armorMat,[0,0,-.04]);mesh(weapon,new THREE.BoxGeometry(.16,.045,.19),edgeMat,[0,.065,-.07]);for(const knuckle of [-.055,0,.055])mesh(weapon,new THREE.CylinderGeometry(.018,.025,.09,6),glowMat,[knuckle,.09,-.13],[Math.PI/2,0,0]);}hand.add(weapon);rig.enemyWeapon=weapon;}
  const walkClip=this.realisticAsset.animations[0];const walkAction=rig.mixer.clipAction(walkClip);const idleClip=walkClip.clone();idleClip.name='Idle_Pose';const idleAction=rig.mixer.clipAction(idleClip);idleAction.play();idleAction.paused=true;idleAction.time=0;rig.actions={idle:idleAction,'brisk walk':walkAction,run:walkAction};rig.activeAction=idleAction;
 }

 addSpiderBossLighting(boss){
  const root=boss.model.root;
  const crimson=new THREE.PointLight('#ff244f',42,25,2);crimson.position.set(0,2.7,-1.6);root.add(crimson);
  const cold=new THREE.PointLight('#6bd8ff',26,20,2);cold.position.set(0,1.6,2.2);root.add(cold);
  boss.model.bossLights=[crimson,cold];
 }
 addSpiderBossSurface(root){
  if(!root)return;
  const shell=new THREE.MeshStandardMaterial({color:'#17232e',metalness:.42,roughness:.24});
  const edge=new THREE.MeshStandardMaterial({color:'#526b7d',metalness:.78,roughness:.2});
  const glow=new THREE.MeshStandardMaterial({color:'#b7193c',emissive:'#ff123d',emissiveIntensity:1.5,metalness:.2,roughness:.18});
  for(let i=0;i<5;i++){
   const ridge=new THREE.Mesh(new THREE.TorusGeometry(.72-i*.055,.025,8,36),edge);
   ridge.position.set(0,1.62-i*.13,.58+i*.16);ridge.rotation.x=Math.PI/2;root.add(ridge);
  }
  for(const side of [-1,1]){
   const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.32,20,16),shell);shoulder.position.set(side*1.12,1.32,.35);shoulder.scale.set(1.25,.65,1.15);shoulder.castShadow=true;root.add(shoulder);
   for(let i=0;i<3;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.11,.55,10),edge);spike.position.set(side*(1.1+i*.13),1.58-i*.12,.25+i*.2);spike.rotation.z=-side*.55;spike.castShadow=true;root.add(spike);}
  }
  const abdomenGlow=new THREE.Mesh(new THREE.SphereGeometry(.36,24,18),glow);abdomenGlow.position.set(0,1.15,1.9);abdomenGlow.scale.set(1.15,.6,.35);root.add(abdomenGlow);
 }
 addBossLighting(boss){
  const root=boss.model.root,color=boss.bossType===0?'#a5ff68':boss.bossType===2?'#8bcfff':'#b87aff';
  const key=new THREE.PointLight(color,boss.bossType===0?48:34,22,2);key.position.set(-1.4,3.5,-1.5);root.add(key);
  const rim=new THREE.PointLight('#d7efff',24,18,2);rim.position.set(1.8,2.5,2);root.add(rim);
  boss.model.bossLights=[key,rim];
 }
 addHulkMusculature(root){
  if(!root)return;
  const skin=new THREE.MeshStandardMaterial({color:'#4e9b3e',roughness:.56,metalness:0});
  const highlight=new THREE.MeshStandardMaterial({color:'#70b957',roughness:.48,metalness:0});
  const shadow=new THREE.MeshStandardMaterial({color:'#326d32',roughness:.68,metalness:0});
  const add=(geo,material,pos,scale,rot)=>{const m=new THREE.Mesh(geo,material);m.position.set(...pos);m.scale.set(...scale);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
  const muscle=(x,y,z,sx,sy,sz,rot=0,material=skin)=>add(new THREE.SphereGeometry(1,32,24),material,[x,y,z],[sx,sy,sz],[0,0,rot]);
  // Broad trapezius, deltoids and thick neck build a powerful silhouette.
  muscle(0,1.57,-.035,.34,.34,.25,0,highlight);
  muscle(0,1.78,-.015,.24,.2,.22,0,skin);
  for(const side of [-1,1]){
   muscle(side*.43,1.55,-.035,.28,.29,.27,side*.12,highlight);
   muscle(side*.52,1.28,-.06,.19,.34,.2,-side*.12,skin);
   muscle(side*.57,.99,-.045,.16,.29,.17,-side*.08,highlight);
   muscle(side*.23,1.32,-.19,.25,.19,.105,side*.12,highlight);
   muscle(side*.19,1.11,-.17,.12,.13,.075,side*.08,skin);
   muscle(side*.35,1.12,-.09,.12,.25,.11,-side*.2,shadow);
   muscle(side*.22,.66,-.035,.18,.36,.2,-side*.05,skin);
   muscle(side*.22,.35,-.02,.14,.25,.15,-side*.03,highlight);
  }
  // Defined pectorals and six-pack abdominal muscle groups.
  muscle(-.18,1.39,-.235,.22,.17,.11,0,highlight);muscle(.18,1.39,-.235,.22,.17,.11,0,highlight);
  for(let row=0;row<3;row++)for(const side of [-1,1])muscle(side*.105,1.16-row*.105,-.235,.095,.067,.065,0,row===1?highlight:skin);
  muscle(0,1.12,-.18,.055,.28,.045,0,shadow);
  // Subtle skin folds and veins catch the rim light.
  for(const side of [-1,1]){
   const veinPts=[new THREE.Vector3(side*.53,1.48,-.245),new THREE.Vector3(side*.58,1.34,-.245),new THREE.Vector3(side*.56,1.18,-.225)];
   const vein=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(veinPts),18,.012,6,false),highlight);root.add(vein);
  }
  const skinBox=new THREE.Mesh(new THREE.SphereGeometry(.22,24,18),skin);skinBox.position.set(0,1.94,-.02);skinBox.scale.set(.9,1.1,.85);skinBox.castShadow=true;root.add(skinBox);
  const brow=new THREE.Mesh(new THREE.BoxGeometry(.36,.07,.08),shadow);brow.position.set(0,1.99,-.205);root.add(brow);
  const eyeMat=new THREE.MeshStandardMaterial({color:'#ffda92',emissive:'#ff542f',emissiveIntensity:1.1,roughness:.22});
  for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,12,10),eyeMat);eye.position.set(side*.075,1.94,-.215);root.add(eye);}
  root.userData.hulkMuscles={skin,highlight};
 }
 addBossArmorDetail(root,type){
  if(!root)return;
  const armor=new THREE.MeshStandardMaterial({color:type===2?'#7895aa':'#4a344f',metalness:.82,roughness:.26});
  const trim=new THREE.MeshStandardMaterial({color:type===2?'#c5d8e5':'#d8a5ff',metalness:.9,roughness:.2,emissive:type===3?'#7130a8':'#16384d',emissiveIntensity:.5});
  for(const side of [-1,1]){
   const pauldron=new THREE.Mesh(new THREE.SphereGeometry(.25,24,18),armor);pauldron.position.set(side*.43,1.62,-.04);pauldron.scale.set(1.3,.8,1.15);pauldron.castShadow=true;root.add(pauldron);
   const trimRing=new THREE.Mesh(new THREE.TorusGeometry(.2,.025,8,28),trim);trimRing.position.set(side*.43,1.61,-.17);trimRing.rotation.y=Math.PI/2;root.add(trimRing);
   for(let i=0;i<3;i++){const plate=new THREE.Mesh(new THREE.BoxGeometry(.18,.24,.07),armor);plate.position.set(side*(.35+i*.035),1.28-i*.24,-.16);plate.rotation.z=side*.12;plate.castShadow=true;root.add(plate);}
  }
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(type===3?.2:.14,2),trim);core.position.set(0,1.35,-.23);root.add(core);
  if(type===2){
   const chest=new THREE.Mesh(new THREE.BoxGeometry(.58,.62,.13),armor);chest.position.set(0,1.48,-.2);chest.rotation.x=-.08;chest.castShadow=true;root.add(chest);
   for(let row=0;row<3;row++)for(const side of [-1,1]){const scale=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),trim);scale.scale.set(1.25,.58,.32);scale.position.set(side*(.19+row*.025),1.32-row*.17,-.29);scale.rotation.z=side*.12;root.add(scale);}
   const hammerGlow=new THREE.PointLight('#7acbff',18,8,2);hammerGlow.position.set(.9,1.45,-.5);root.add(hammerGlow);
   for(const side of [-1,1]){const knee=new THREE.Mesh(new THREE.DodecahedronGeometry(.2),armor);knee.position.set(side*.22,.47,-.13);root.add(knee);}
  }else if(type===3){
   const ribMat=new THREE.MeshStandardMaterial({color:'#261c35',metalness:.72,roughness:.3,emissive:'#42146c',emissiveIntensity:.3});
   for(let row=0;row<4;row++)for(const side of [-1,1]){const rib=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.26,4,8),ribMat);rib.position.set(side*(.2+row*.015),1.38-row*.13,-.245);rib.rotation.z=side*.62;root.add(rib);}
   const collar=new THREE.Mesh(new THREE.TorusGeometry(.34,.065,10,32),trim);collar.position.set(0,1.77,-.08);root.add(collar);
   const shoulderSpikes=[];
   for(const side of [-1,1])for(let i=0;i<3;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.12,.72-i*.1,10),trim);spike.position.set(side*(.55+i*.09),1.72-i*.13,.02+i*.12);spike.rotation.z=side*.78;spike.castShadow=true;root.add(spike);shoulderSpikes.push(spike);}
   const mantle=new THREE.Mesh(new THREE.ConeGeometry(.72,1.15,8,1,true),ribMat);mantle.position.set(0,1.45,.28);mantle.rotation.x=-.25;root.add(mantle);
   const voidCore=new THREE.Mesh(new THREE.IcosahedronGeometry(.22,2),new THREE.MeshStandardMaterial({color:'#a85cff',emissive:'#7b22e6',emissiveIntensity:1.7,metalness:.45,roughness:.16}));voidCore.position.set(0,1.42,-.34);root.add(voidCore);
   const voidLight=new THREE.PointLight('#a34cff',26,10,2);voidLight.position.set(0,1.42,-.65);root.add(voidLight);
  }
 }
 bind(){
  window.addEventListener('pointerdown',()=>this.audio.unlock(),{once:true,passive:true});
  window.addEventListener('keydown',e=>{if(e.code==='AltLeft'||e.code==='AltRight'){document.exitPointerLock?.();this.keys={};this.setBlock(false);return;}this.keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space')this.dodge();if(e.code==='KeyJ'||e.code==='Enter')this.attack();if(e.code==='KeyL')this.iaido();if(e.code==='KeyK')this.setBlock(true);if(e.code==='KeyE')this.pickupChest();if(e.code==='KeyR')this.ultimate();if(e.code==='KeyC')this.onStatsToggle?.();if(e.code==='KeyO')this.onEnvironmentToggle?.();if(e.code==='Digit1')this.switchWeapon('solar');if(e.code==='Digit2')this.switchWeapon('demon');if(e.code==='Digit3')this.switchWeapon('ak');if(e.code==='Digit4')this.switchWeapon('katana');});
  window.addEventListener('keyup',e=>{this.keys[e.code]=false;if(e.code==='KeyK')this.setBlock(false);});
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas)clearMovementKeys();});
  const clearMovementKeys=()=>{this.keys={};this.setBlock(false);};window.addEventListener('blur',clearMovementKeys);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMovementKeys();});
  const canvas=this.renderer.domElement;let lookId=null,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',e=>{if(this.paused)return;if(this.isTouch()){lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;}else if(e.button===0&&!this.pointerLocked){canvas.requestPointerLock?.();}});
  document.addEventListener('pointerlockchange',()=>{this.pointerLocked=document.pointerLockElement===canvas;});
  canvas.addEventListener('pointermove',e=>{if(this.isTouch()&&lookId===e.pointerId){this.cameraYaw-=(e.clientX-lastX)*.006*(this.mouseSensitivity||1);this.cameraPitch=THREE.MathUtils.clamp(this.cameraPitch-(e.clientY-lastY)*.004*(this.mouseSensitivity||1),-.8,.8);lastX=e.clientX;lastY=e.clientY;}});
  const endLook=e=>{if(lookId===e.pointerId)lookId=null;};canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
  window.addEventListener('mousemove',e=>{if(this.paused||this.isTouch())return;if(this.pointerLocked){this.cameraYaw-=e.movementX*.0025*(this.mouseSensitivity||1);this.cameraPitch=THREE.MathUtils.clamp(this.cameraPitch-e.movementY*.0018*(this.mouseSensitivity||1),-.8,.8);}else if(e.target===canvas){if(this.lastMouseX!==undefined){this.cameraYaw-=(e.clientX-this.lastMouseX)*.004*(this.mouseSensitivity||1);this.cameraPitch=THREE.MathUtils.clamp(this.cameraPitch-(e.clientY-this.lastMouseY)*.003*(this.mouseSensitivity||1),-.8,.8);}this.lastMouseX=e.clientX;this.lastMouseY=e.clientY;}});
  canvas.addEventListener('mouseenter',e=>{this.lastMouseX=e.clientX;this.lastMouseY=e.clientY;});
  window.addEventListener('mousedown',e=>{if(e.button===0&&!this.isTouch()&&!this.paused&&!e.target.closest('button'))this.attack();if(e.button===2&&!this.isTouch())this.iaido();});window.addEventListener('contextmenu',e=>e.preventDefault());
 }

moveEnemyToward(e,delta,radius=.42){const root=e.model.root,start=root.position.clone();this.moveActor(root,delta,radius,e);let moved=root.position.distanceTo(start);if(moved>.025){e.navBlocked=false;e.navBlockedTime=0;e.lastMoveAt=performance.now();return moved;}e.navBlocked=true;e.navBlockedTime=(e.navBlockedTime||0)+Math.min(.1,delta.length());if(e.navBlockedTime>.45){e.navSide=-(e.navSide||1);e.navBlockedTime=0;}const direction=delta.clone().setY(0);if(direction.lengthSq()<1e-8)return 0;direction.normalize();const distance=Math.max(.025,delta.length()),side=e.navSide||1,angles=[side*.95,-side*.95,side*1.55,-side*1.55,Math.PI];for(const angle of angles){const candidate=direction.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle).multiplyScalar(distance),before=root.position.clone();this.moveActor(root,candidate,radius,e);moved=root.position.distanceTo(before);if(moved>.025){e.navBlocked=false;e.navBlockedTime=0;e.lastMoveAt=performance.now();return moved;}}if(performance.now()-(e.lastMoveAt||0)>3200)this.relocateLostEnemy(e);return 0;}
 relocateLostEnemy(e){if(!e||e.dead||!e.model?.root)return;const root=e.model.root,p=this.player.root.position,dist=root.position.distanceTo(p);if(Number.isFinite(dist)&&dist<24&&!e.navBlocked)return;const point=this.findEnemySpawnPoint(e.spawnIndex??0,Math.max(1,this.enemies.filter(x=>!x.dead).length));root.position.copy(point);root.position.y=0;root.visible=true;root.rotation.y=Math.atan2(p.x-point.x,p.z-point.z);e.navBlocked=false;e.navBlockedTime=0;e.lastMoveAt=performance.now();}
  // Move an actor in axis-separated steps so it slides along solid building walls
 // instead of tunnelling through them. Also keep living enemies from overlapping.
 moveActor(root, delta, radius = .42, actor = null) {
  const colliders = this.world.buildingColliders || [];
  const segments = this.citySegments || [{ z: 0 }];
  const blocked = (x, z) => {
   const dynamic = [this.chest?.group?.position, this.bossDrop?.group?.position].filter(Boolean);
   for (const p of dynamic) { const dx=x-p.x,dz=z-p.z; if(dx*dx+dz*dz < (radius+.82)*(radius+.82)) return true; }
   for (const seg of segments) for (const c of colliders) {
    const cz = z - (seg.z || 0);
    if (c.type === 'circle') { const dx=x-c.x, dz=cz-c.z; if (dx*dx+dz*dz < (c.r+radius)*(c.r+radius)) return true; }
    else if (x > c.minX-radius && x < c.maxX+radius && cz > c.minZ-radius && cz < c.maxZ+radius) return true;
   }
   return false;
  };
  const startX=root.position.x,startZ=root.position.z;
  const x=startX+delta.x;if(!blocked(x,startZ))root.position.x=x;
  const z=startZ+delta.z;if(!blocked(root.position.x,z))root.position.z=z;
  // Character bodies are solid too: the player and living enemies cannot occupy the same space.
  const px=this.player?.root?.position;
  if(actor && px && px!==root.position){
   const min=radius+.46,dx=root.position.x-px.x,dz=root.position.z-px.z,d2=dx*dx+dz*dz;
   if(d2<min*min){const d=Math.sqrt(d2)||.001,nx=dx/d,nz=dz/d,push=min-d;const tx=root.position.x+nx*push,tz=root.position.z+nz*push;if(!blocked(tx,root.position.z))root.position.x=tx;if(!blocked(root.position.x,tz))root.position.z=tz;}
  }
  if(actor){
   for(const other of this.enemies){
    if(other===actor||other.dead||!other.model?.root)continue;
    const or=other.spider?1.15:other.boss?.95:other.elite?.78:.42,min=radius+or,dx=root.position.x-other.model.root.position.x,dz=root.position.z-other.model.root.position.z,d2=dx*dx+dz*dz;
    if(d2>=min*min)continue;
    const d=Math.sqrt(d2)||.001,nx=dx/d,nz=dz/d,push=min-d,tx=root.position.x+nx*push,tz=root.position.z+nz*push;
    if(!blocked(tx,root.position.z))root.position.x=tx;if(!blocked(root.position.x,tz))root.position.z=tz;
   }
  } else {
   for(const other of this.enemies){
    if(other.dead||!other.model?.root)continue;
    const or=other.spider?1.15:other.boss?.95:other.elite?.78:.42,min=radius+or,dx=root.position.x-other.model.root.position.x,dz=root.position.z-other.model.root.position.z,d2=dx*dx+dz*dz;
    if(d2>=min*min)continue;
    const d=Math.sqrt(d2)||.001,nx=dx/d,nz=dz/d,push=min-d,tx=root.position.x+nx*push,tz=root.position.z+nz*push;
    if(!blocked(tx,root.position.z))root.position.x=tx;if(!blocked(root.position.x,tz))root.position.z=tz;
   }
  }
  return root.position;
 }
 isTouch(){return matchMedia('(pointer: coarse)').matches;}setMobileMove(x,y){this.mobile.x=x;this.mobile.y=y;}setBlock(v){if(v&&!this.block)this.parryWindow=.24;this.block=v;}
 start(){this.started=true;this.clock.start();this.loop();}pause(){this.paused=true;document.exitPointerLock?.();document.querySelector('#pauseOverlay').classList.remove('hidden');}resume(){this.paused=false;document.querySelector('#pauseOverlay').classList.add('hidden');this.clock.getDelta();}
 attack(){if(this.paused||this.hp<=0||this.encounterCleared||this.attackTime>0||this.iaidoTime>0)return;this.attackCount=(this.attackCount||0)+1;localStorage.setItem('ns_attack_count',this.attackCount);this.checkExpandedAchievements('attacks',this.attackCount);this.trackQuest('attacks');this.attackTime=Math.max(.12,.42/(1+(this.attackSpeedBonus||0))*(this.poisonTime>0?2:1));this.combo=this.comboWindow>0?this.combo%3+1:1;this.comboWindow=.9;this.bestCombo=Math.max(this.bestCombo,this.combo);localStorage.setItem('ns_best_combo',this.bestCombo);if(this.combo>=3)this.unlockAchievement('combo_3','三段连斩','完成一次三连击',25);const p=this.player.root;let target=null,best=3.6;for(const e of this.enemies){if(e.dead)continue;const d=p.position.distanceTo(e.model.root.position),dir=e.model.root.position.clone().sub(p.position).normalize(),facing=new THREE.Vector3(0,0,-1).applyQuaternion(p.quaternion);if(d<best&&facing.dot(dir)>.0){best=d;target=e;}}const damage=(this.activeWeapon==='katana'?30*(this.attackMultiplier||1) :Math.round((this.baseAttack||15)*(1+(this.skillAttackBonus||0))))*(this.activeWeapon==='solar'?1.65:this.activeWeapon==='demon'?1.2:this.activeWeapon==='ak'?.8:1);this.audio.play('slash');if(this.activeWeapon==='ak'){this.spawnWeaponProjectile(damage,34,target);}else{this.spawnBladeWave(damage,this.activeWeapon==='demon'?'#b86cff':this.activeWeapon==='solar'?'#ffd45c':this.swordColor,target);}if(target){this.damageEnemy(target,damage);target.stun=.5;}if(this.activeWeapon==='katana')this.swordCharge=Math.min(3,this.swordCharge+1);this.onToast?.(this.activeWeapon==='ak'?'AK47 连射':target?'挥砍 + 蓝色剑气':'挥砍 + 剑气');this.updateUI();}
 iaido(){if(this.paused||this.hp<=0||this.iaidoTime>0||this.attackTime>0)return;this.iaidoTime=.72;this.invuln=Math.max(this.invuln,.28);const p=this.player.root,dir=new THREE.Vector3(0,0,-1).applyQuaternion(p.quaternion).normalize();p.position.addScaledVector(dir,2.2);let hit=null,best=4.4;for(const e of this.enemies){if(e.dead)continue;const d=p.position.distanceTo(e.model.root.position),to=e.model.root.position.clone().sub(p.position).normalize();if(d<best&&dir.dot(to)>.35){best=d;hit=e;}}this.audio.play('iaido');if(hit){this.damageEnemy(hit,200);hit.stun=.9;this.onToast?.('居合拔刀斩！');}}
 spawnBladeWave(damage=15,color='#39dfff',ignore=null){const dir=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.root.quaternion).normalize(),origin=this.player.root.position.clone().add(new THREE.Vector3(0,1.25,0)).addScaledVector(dir,1.1),group=new THREE.Group();this.scene.add(group);group.position.copy(origin);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),dir);const glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false});const arc=new THREE.Mesh(new THREE.TorusGeometry(.62,.075,8,28,Math.PI),glow);arc.position.y=.35;arc.rotation.z=Math.PI;group.add(arc);const core=new THREE.Mesh(new THREE.PlaneGeometry(.12,1.45),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));core.position.set(0,.35,.03);group.add(core);this.waves.push({group,dir,life:1.05,hit:new Set(ignore?[ignore]:[]),speed:27,color,damage});}
spawnWeaponProjectile(damage=12,speed=34,ignore=null){const dir=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.root.quaternion).normalize(),group=new THREE.Group();this.scene.add(group);group.position.copy(this.player.root.position).add(new THREE.Vector3(0,1.25,0)).addScaledVector(dir,1);const bullet=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.62,8),new THREE.MeshBasicMaterial({color:'#ffd36b',emissive:'#ff9d25'}));bullet.rotation.x=Math.PI/2;group.add(bullet);this.waves.push({group,dir,life:1.3,hit:new Set(ignore?[ignore]:[]),speed,color:'#ffd36b',damage});}
makeWeaponVisual(id){if(this.weaponVisual){this.player.root.remove(this.weaponVisual);this.weaponVisual=null;}if(id==='katana'){this.player.sword.visible=true;return;}this.player.sword.visible=false;const g=new THREE.Group();g.position.set(.5,1.12,.02);this.player.root.add(g);this.weaponVisual=g;if(id==='solar'){const blade=new THREE.Mesh(new THREE.BoxGeometry(.16,1.25,.055),new THREE.MeshStandardMaterial({color:'#f8df91',metalness:.8,roughness:.2,emissive:'#a86a16',emissiveIntensity:.45}));blade.position.y=.62;g.add(blade);const guard=new THREE.Mesh(new THREE.TorusGeometry(.2,.045,8,24),new THREE.MeshStandardMaterial({color:'#ffd66b',metalness:.8}));guard.position.y=.12;g.add(guard);const core=new THREE.Mesh(new THREE.BoxGeometry(.055,1.1,.07),new THREE.MeshBasicMaterial({color:'#fff1a6'}));core.position.y=.64;g.add(core);}else if(id==='demon'){for(let i=0;i<9;i++){const shard=new THREE.Mesh(new THREE.BoxGeometry(.09,.34,.045),new THREE.MeshStandardMaterial({color:'#9d4bff',emissive:'#6c1bc9',emissiveIntensity:.8,metalness:.35}));shard.position.set(Math.sin(i*1.7)*.11,.18+i*.12,Math.cos(i*1.7)*.035);shard.rotation.z=(i-4)*.045;g.add(shard);}}else{const body=new THREE.Mesh(new THREE.BoxGeometry(.14,.72,.16),new THREE.MeshStandardMaterial({color:'#30383b',metalness:.65,roughness:.35}));body.position.y=.28;g.add(body);const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.62,8),new THREE.MeshStandardMaterial({color:'#171b1d',metalness:.7}));barrel.rotation.x=Math.PI/2;barrel.position.set(0,.46,-.28);g.add(barrel);const stock=new THREE.Mesh(new THREE.BoxGeometry(.12,.2,.24),new THREE.MeshStandardMaterial({color:'#765239'}));stock.position.set(0,.02,.13);g.add(stock);}}
switchWeapon(id){if(id==='katana'){this.activeWeapon=id;this.makeWeaponVisual(id);this.refreshFirstPersonWeapon();this.onWeaponChange?.(id);this.updateUI();this.onToast?.('切换：太刀');return;}if(!this.weaponOwned[id]){this.onToast?.('尚未解锁该武器');return;}this.activeWeapon=id;this.makeWeaponVisual(id);this.refreshFirstPersonWeapon();this.onWeaponChange?.(id);this.updateUI();this.onToast?.('已切换：'+({solar:'太阳神剑',demon:'魔刀千刃',ak:'AK47'}[id]));}
chooseWeapon(id){if(!['solar','demon','ak'].includes(id))return;this.weaponOwned[id]=true;localStorage.setItem('ns_weapon_owned',JSON.stringify(this.weaponOwned));this.switchWeapon(id);this.onToast?.('解锁武器：'+({solar:'太阳神剑',demon:'魔刀千刃',ak:'AK47'}[id]));this.saveCampaign();this.updateUI();}
ultimate(){if(this.paused||this.hp<=0)return;if(this.activeWeapon==='solar'){this.timeStop=1.15;this.spawnBladeWave(120,'#ffe47a');const p=this.player.root.position.clone(),target=this.enemies.filter(e=>!e.dead).sort((a,b)=>a.model.root.position.distanceTo(p)-b.model.root.position.distanceTo(p))[0]?.model.root.position||p.clone().add(new THREE.Vector3(0,0,-12)),sun=new THREE.Mesh(new THREE.SphereGeometry(6,28,20),new THREE.MeshBasicMaterial({color:'#ffbd35',transparent:true,opacity:.9,emissive:'#d47a12',emissiveIntensity:.45}));sun.position.copy(target).add(new THREE.Vector3(0,18,0));this.scene.add(sun);this.waves.push({group:sun,dir:new THREE.Vector3(0,-1,0),life:1.5,hit:new Set(),speed:12,damage:650});this.onToast?.('太阳神剑：时停斩击 · 巨型太阳坠落！');}else if(this.activeWeapon==='demon'){this.spawnBladeWave(260,'#a44cff');const w=this.waves[this.waves.length-1];w.baseScale=new THREE.Vector3(3.5,1.6,1.2);w.life=1.45;w.speed=36;for(let i=0;i<24;i++){const shard=new THREE.Mesh(new THREE.BoxGeometry(.06,.32,.04),new THREE.MeshBasicMaterial({color:'#bd79ff',emissive:'#7d20d5',emissiveIntensity:1}));shard.position.set((Math.random()-.5)*2,(Math.random()-.5)*1.6,.1);w.group.add(shard);}this.onToast?.('魔刀千刃：紫色碎片散开，超长刀刃斩击！');}else if(this.activeWeapon==='ak'){for(let i=0;i<8;i++)this.spawnWeaponProjectile(45,42);this.onToast?.('AK47：火力全开！');}else{this.spawnBladeWave(120,this.swordColor);this.onToast?.('太刀奥义：强力剑气！');}}
spawnBoss(){this.spawnBossType(Math.floor((this.districtNumber-1)/6)%4);}
spawnBossType(type){if(this.bossActive)return;let model,boss;const z=this.player.root.position.z-20,x=this.player.root.position.x;if(type===1){model={root:new THREE.Group(),anim:0,legL:new THREE.Group(),legR:new THREE.Group(),armL:new THREE.Group(),armR:new THREE.Group(),hpFill:null};this.scene.add(model.root);const body=new THREE.Mesh(new THREE.SphereGeometry(1.6,20,16),mat('#111820',.3,.6));body.scale.set(1.3,.65,1.7);body.position.y=1.3;model.root.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.65,16,12),mat('#18232d',.3,.5));head.position.set(0,2,-1.6);model.root.add(head);const spiderArmor=mat('#263747',.22,.82),spiderEdge=mat('#8299a9',.2,.9),spiderJoint=mat('#101820',.38,.62),spiderGlow=new THREE.MeshStandardMaterial({color:'#ff294f',emissive:'#ff103c',emissiveIntensity:2.1,metalness:.25,roughness:.18});for(let i=0;i<8;i++){const a=i/8*Math.PI*2,leg=new THREE.Group();leg.position.set(Math.cos(a)*1.1,1.2,Math.sin(a)*1.1);model.root.add(leg);const upper=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,1.5,12),spiderArmor);upper.position.set(Math.cos(a)*.6,-.45,Math.sin(a)*.6);upper.rotation.z=Math.cos(a)*-.6;upper.castShadow=true;leg.add(upper);const lower=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,1.35,12),spiderEdge);lower.position.set(Math.cos(a)*1.1,-1.2,Math.sin(a)*1.1);lower.castShadow=true;leg.add(lower);const joint=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),spiderJoint);joint.position.set(Math.cos(a)*.6,-.45,Math.sin(a)*.6);leg.add(joint);const cuff=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,8,18),spiderEdge);cuff.position.copy(lower.position).add(new THREE.Vector3(0,.48,0));leg.add(cuff);const claw=new THREE.Mesh(new THREE.ConeGeometry(.085,.42,10),spiderArmor);claw.position.set(Math.cos(a)*1.1,-1.88,Math.sin(a)*1.1);claw.rotation.z=Math.cos(a)*-.45;leg.add(claw);leg.userData.phase=a;model.legs??=[];model.legs.push(leg);}const abdomen=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),mat('#17232d',.26,.72));abdomen.scale.set(1.32,.72,1.55);abdomen.position.set(0,1.12,.95);abdomen.castShadow=true;model.root.add(abdomen);for(let i=0;i<3;i++){const plate=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),spiderArmor);plate.scale.set(1.12-i*.13,.18,.38);plate.position.set(0,1.55-i*.2,1.05+i*.31);model.root.add(plate);}const dorsal=new THREE.Mesh(new THREE.TorusGeometry(.48,.065,10,32),spiderGlow);dorsal.position.set(0,1.58,1.38);model.root.add(dorsal);const mandibles=new THREE.Group();mandibles.position.set(0,1.65,-2.02);model.root.add(mandibles);for(const side of [-1,1]){const fang=new THREE.Mesh(new THREE.ConeGeometry(.14,.62,12),spiderEdge);fang.position.set(side*.22,-.32,-.12);fang.rotation.z=side*.32;mandibles.add(fang);const palp=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.48,4,10),spiderArmor);palp.position.set(side*.48,-.05,-.05);palp.rotation.z=side*.55;mandibles.add(palp);}for(let row=0;row<2;row++)for(let i=0;i<4;i++){const side=i<2?-1:1,eye=new THREE.Mesh(new THREE.SphereGeometry(row===0?.105:.075,16,12),spiderGlow);eye.position.set(side*(.16+(i%2)*.19),2.08-row*.22,-2.08);model.root.add(eye);}const brow=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,8,28),spiderEdge);brow.position.set(0,2.13,-2.05);model.root.add(brow);const cycle=Math.floor((this.districtNumber-1)/6),bossScale=1+cycle*.28;boss={model,hp:1300*bossScale,maxHp:1300*bossScale,attack:2,stun:0,dead:false,boss:true,bossType:type,spider:true,damageMultiplier:bossScale};}else{model=type===0?makeHulkBoss(this.scene):makeOtherBoss(this.scene,type);model.root.scale.setScalar(type===0?.82:type===2?1.35:1.15);const cycle=Math.floor((this.districtNumber-1)/6),bossScale=1+cycle*.28;boss={model,hp:[700,1300,1900,2450][type]*bossScale,maxHp:[700,1300,1900,2450][type]*bossScale,attack:2.2,stun:0,dead:false,boss:true,bossType:type,damageMultiplier:bossScale};}const bossSpawn=this.findEnemySpawnPoint(0,1,boss.spider?2.15:1.55);model.root.position.copy(bossSpawn);const toPlayer=this.player.root.position.clone().sub(bossSpawn);model.root.rotation.y=Math.atan2(-toPlayer.x,-toPlayer.z);boss.spawnIndex=0;boss.lastMoveAt=performance.now();if(boss.spider){this.addSpiderBossLighting(boss);this.addSpiderBossSurface(boss.model.root);}else this.addBossLighting(boss);this.enemies.push(boss);this.bossActive=true;this.onBoss?.({hp:boss.hp,maxHp:boss.maxHp,show:true,name:['绿巨人','黑蜘蛛','裂地巨像','虚空收割者'][type]});this.onToast?.('BOSS 来袭：'+['绿巨人','黑蜘蛛','裂地巨像','虚空收割者'][type]);}
spawnEncounter(){if(this.chest?.group){this.scene.remove(this.chest.group);this.chest=null;}if(this.bossDrop?.group){this.scene.remove(this.bossDrop.group);this.bossDrop=null;}for(const e of this.enemies)this.scene.remove(e.model.root);for(const b of this.bullets)this.scene.remove(b.mesh);for(const w of this.waves)this.scene.remove(w.group);this.enemies=[];this.bullets=[];this.waves=[];const n=(this.districtNumber-1)%6+1;this.bossActive=false;if(n<=3)this.spawnWave(5+n);else if(n===4){this.spawnWave(6);this.spawnElites(2);}else if(n===5)this.spawnElites(5);else this.spawnBossType(Math.floor((this.districtNumber-1)/6)%4);this.encounterActive=true;this.encounterCleared=false;this.onAdvance?.({show:false,district:this.districtNumber});this.onDistrict?.(this.districtNumber);this.updateUI();}
spawnElites(n){for(let i=0;i<n;i++){const model=makeEliteSuit(this.scene,100+i);model.root.scale.setScalar(1.08);const spawn=this.findEnemySpawnPoint(i,n,.85);model.root.position.copy(spawn);model.root.rotation.y=Math.atan2(this.player.root.position.x-spawn.x,this.player.root.position.z-spawn.z);const scale=1+Math.floor((this.districtNumber-1)/6)*.22;setHealthDisplay(model,450*scale,450*scale,1.28);const elite={model,hp:450*scale,maxHp:450*scale,attack:1.8*scale,damage:18*scale,stun:0,dead:false,elite:true,ranged:i%2===1,seed:100+i,spawnIndex:i,lastMoveAt:performance.now(),navSide:i%2?1:-1};this.enemies.push(elite);}}showAdvanceArrow(z){if(this.advanceArrow){this.scene.remove(this.advanceArrow);this.advanceArrow.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});}const shape=new THREE.Shape();shape.moveTo(0,2.55);shape.lineTo(-.82,1.05);shape.lineTo(-.34,1.05);shape.lineTo(-.34,-1.55);shape.lineTo(.34,-1.55);shape.lineTo(.34,1.05);shape.lineTo(.82,1.05);shape.closePath();const geometry=new THREE.ShapeGeometry(shape);const positions=geometry.attributes.position,colors=[];const stops=[new THREE.Color('#ff304f'),new THREE.Color('#ff9c28'),new THREE.Color('#fff044'),new THREE.Color('#43f17b'),new THREE.Color('#22e5ff'),new THREE.Color('#3978ff'),new THREE.Color('#b45cff')];for(let i=0;i<positions.count;i++){const t=THREE.MathUtils.clamp((positions.getY(i)+1.55)/4.1,0,1)*(stops.length-1),idx=Math.min(stops.length-2,Math.floor(t)),c=stops[idx].clone().lerp(stops[idx+1],t-idx);colors.push(c.r,c.g,c.b);}geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.rotateX(-Math.PI/2);const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.96,depthWrite:false});this.advanceArrow=new THREE.Group();const arrow=new THREE.Mesh(geometry,material);arrow.position.y=.14;arrow.renderOrder=5;arrow.scale.set(1.35,1,1.35);this.advanceArrow.add(arrow);const halo=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));halo.scale.set(1.22,1.12,1.22);halo.position.y=.105;halo.rotation.x=-Math.PI/2;this.advanceArrow.add(halo);const beacon=new THREE.PointLight('#54f5ff',7,7,2);beacon.position.y=.45;this.advanceArrow.add(beacon);this.advanceArrow.position.set(0,0,z);this.scene.add(this.advanceArrow);}
 advanceDistrict(){this.unlockAchievement('district_'+Math.min(30,this.districtNumber),'街区征服者','推进至第 '+this.districtNumber+' 街区',Math.min(120,15+this.districtNumber*3));if(!this.encounterCleared)return;if(this.advanceArrow){this.scene.remove(this.advanceArrow);this.advanceArrow.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});this.advanceArrow=null;}this.districtNumber++;this.districtProgress=this.districtNumber;this.checkExpandedAchievements('districts',this.districtNumber-1);this.saveCampaign();this.spawnEncounter();this.onToast?.('进入街区 '+this.districtNumber);}
createFirstPersonWeapon(){const g=new THREE.Group();const arm=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.22),mat('#252b32'));arm.position.set(.42,-.48,-.68);g.add(arm);const blade=new THREE.Mesh(new THREE.BoxGeometry(.055,.8,.045),mat('#dce8ef',.2,.85));blade.position.set(.43,-.05,-1);blade.rotation.z=-.18;g.add(blade);const grip=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.3,8),mat('#17191d'));grip.position.set(.43,-.55,-.68);g.add(grip);this.fpWeapon=g;this.camera.add(g);this.refreshFirstPersonWeapon();}
refreshFirstPersonWeapon(){
  if(!this.fpWeapon)return;
  while(this.fpWeapon.children.length){const child=this.fpWeapon.children.pop();child.parent=null;child.traverse?.(o=>{if(o.geometry)o.geometry.dispose();});}
  const id=this.activeWeapon;
  const add=(geo,material,pos,rot)=>{const m=new THREE.Mesh(geo,material);m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;this.fpWeapon.add(m);return m;};
  const steel=new THREE.MeshStandardMaterial({color:'#aebbc5',metalness:.94,roughness:.2});
  const darkSteel=new THREE.MeshStandardMaterial({color:'#202a32',metalness:.88,roughness:.27});
  const black=new THREE.MeshStandardMaterial({color:'#11171c',metalness:.48,roughness:.62});
  const leather=new THREE.MeshStandardMaterial({color:'#493326',metalness:.05,roughness:.88});
  const gold=new THREE.MeshStandardMaterial({color:'#c69b4d',metalness:.88,roughness:.22});
  const glow=(color)=>new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.18,emissive:color,emissiveIntensity:.8});
  add(new THREE.BoxGeometry(.2,.4,.18),new THREE.MeshStandardMaterial({color:'#252b32',roughness:.72,metalness:.25}),[.42,-.49,-.68]);
  if(id==='ak'){
    add(new THREE.BoxGeometry(.19,.22,.58),darkSteel,[.42,-.39,-.79]);
    add(new THREE.BoxGeometry(.17,.16,.28),leather,[.42,-.43,-.37]);
    add(new THREE.BoxGeometry(.12,.3,.2),leather,[.42,-.57,-.67]);
    add(new THREE.BoxGeometry(.14,.34,.2),darkSteel,[.42,-.64,-.78]);
    add(new THREE.BoxGeometry(.11,.12,.38),leather,[.42,-.39,-1.04]);
    const barrel=add(new THREE.CylinderGeometry(.035,.045,.78,20),steel,[.42,-.31,-1.22],[Math.PI/2,0,0]);
    add(new THREE.CylinderGeometry(.052,.052,.12,20),darkSteel,[.42,-.31,-1.59],[Math.PI/2,0,0]);
    add(new THREE.CylinderGeometry(.058,.058,.08,20),steel,[.42,-.31,-1.66],[Math.PI/2,0,0]);
    add(new THREE.BoxGeometry(.16,.055,.3),black,[.42,-.25,-.99]);
    add(new THREE.BoxGeometry(.045,.1,.09),steel,[.42,-.18,-.94]);
    add(new THREE.BoxGeometry(.035,.09,.1),steel,[.42,-.18,-1.37]);
    for(let i=0;i<5;i++)add(new THREE.BoxGeometry(.2,.018,.035),darkSteel,[.42,-.27,-.63-i*.075]);
    for(const side of [-1,1])for(let i=0;i<3;i++)add(new THREE.CylinderGeometry(.012,.012,.018,10),steel,[.42+side*.096,-.39,-.58-i*.12],[0,0,Math.PI/2]);
  }else{
    const color=id==='solar'?'#ffe08a':id==='demon'?'#a85cff':'#dce8ef';
    const bladeMat=new THREE.MeshStandardMaterial({color:id==='demon'?'#b9a1d8':'#cbd6df',metalness:.98,roughness:.13,emissive:id==='demon'?'#6d20b9':id==='solar'?'#9b641b':'#102536',emissiveIntensity:id==='katana'?.08:.45});
    const shape=new THREE.Shape();shape.moveTo(-.045,0);shape.quadraticCurveTo(-.02,.35,-.015,.72);shape.quadraticCurveTo(.01,1.02,.085,1.2);shape.lineTo(.115,1.19);shape.quadraticCurveTo(.055,.68,.035,0);shape.closePath();
    const bladeGeo=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.012,bevelThickness:.012});bladeGeo.computeVertexNormals();
    const blade=add(bladeGeo,bladeMat,[.43,-.59,-1.03],[0,0,-.1]);
    const hamonPts=[];for(let i=0;i<=18;i++){const y=i/18*1.12;hamonPts.push(new THREE.Vector3(.02+Math.sin(i*.72)*.012,y,.045));}
    const hamon=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hamonPts),48,.006,6,false),new THREE.MeshStandardMaterial({color:'#f4fbff',metalness:.6,roughness:.22,emissive:'#8ab8d5',emissiveIntensity:.24}),[.43,-.59,-1.03],[0,0,-.1]);
    add(new THREE.BoxGeometry(.24,.045,.08),id==='solar'?gold:darkSteel,[.43,-.48,-1.02]);
    add(new THREE.TorusGeometry(.105,.018,10,32),id==='demon'?glow('#a64cff'):gold,[.43,-.48,-1.02],[Math.PI/2,0,0]);
    add(new THREE.CylinderGeometry(.035,.04,.34,16),leather,[.43,-.72,-1.02],[0,0,0]);
    for(let i=0;i<7;i++){const wrap=add(new THREE.TorusGeometry(.039,.008,6,16),id==='demon'?glow('#b879ff'):darkSteel,[.43,-.59-i*.038,-1.02],[Math.PI/2,0,0]);}
    add(new THREE.SphereGeometry(.055,16,12),gold,[.43,-.91,-1.02]);
    if(id==='solar'){for(const side of [-1,1])add(new THREE.BoxGeometry(.035,1.05,.035),glow('#ffe7a0'),[.43+side*.075,-.02,-1.01]);}
    if(id==='demon'){for(let i=0;i<9;i++){const shard=add(new THREE.DodecahedronGeometry(.045,1),glow('#9c4cff'),[.43+Math.sin(i*1.7)*.12,-.4+i*.105,-1.02]);shard.rotation.z=(i-4)*.07;}}
  }
 }
awardCore(type){const core={name:['巨力核心','蛛皇核心','裂地核心','虚空核心'][type]||'未知核心',attack:0,speed:0,crit:0,critDmg:0,hp:0};if(type===0){core.attack=8;core.hp=10;}if(type===1){core.speed=25;core.crit=10;core.critDmg=50;core.hp=25;}if(type===2){core.attack=12;core.hp=15;}if(type===3){core.crit=8;core.critDmg=35;core.speed=10;}this.coreInventory.push(core);this.saveCampaign();this.onCore?.(this.coreSlots,this.coreInventory);this.onToast?.('获得核心：'+core.name+'，请在 C 角色面板装备');}
equipCore(index){const core=this.coreInventory[index];if(this.cores.includes(core)){this.onToast?.('该核心已经装备');return;}const slot=this.coreSlots.findIndex(x=>!x);if(!core||slot<0){this.onToast?.('核心槽已满');return;}this.coreSlots[slot]=core;this.cores.push(core);this.applyCores();this.saveCampaign();this.onCore?.(this.coreSlots,this.coreInventory);this.updateUI();this.onToast?.('已装备：'+core.name);}
applyCores(){this.attackSpeedBonus=this.cores.reduce((a,c)=>a+c.speed/100,0)+this.shopSpeedBonus;this.critBonus=this.cores.reduce((a,c)=>a+c.crit/100,0)+this.shopCritBonus;this.critDamageBonus=this.cores.reduce((a,c)=>a+c.critDmg/100,0)+this.shopCritDmgBonus;this.maxHp=100+5*((this.level||1)-1)+this.cores.reduce((a,c)=>a+(Number(c.hp)||0),0)+this.shopHpBonus+(this.unlockedSkills?.includes('vital')?20:0);this.hp=Math.min(Number.isFinite(this.hp)?this.hp:this.maxHp,this.maxHp);this.baseAttack=Math.round((15+this.cores.reduce((a,c)=>a+(Number(c.attack)||0),0))*(this.attackMultiplier||1));}
spiderWeb(e){const start=e.model.root.position.clone().add(new THREE.Vector3(0,1.5,0)),target=this.player.root.position.clone().add(new THREE.Vector3(0,1,0)),dir=target.clone().sub(start).normalize(),web=new THREE.Group();this.scene.add(web);web.position.copy(start);for(let i=0;i<6;i++){const line=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,2.4,5),new THREE.MeshBasicMaterial({color:'#d6e7ec',transparent:true,opacity:.8}));line.rotation.z=i*Math.PI/6;web.add(line);}this.bullets.push({mesh:web,vel:dir.multiplyScalar(15),life:2.8,source:e,web:true,damage:16*(e.damageMultiplier||1)*(e.enraged?1.25:1)});this.onToast?.('黑蜘蛛吐出蛛网！');}
buyShopItem(id){const item=this.shopItems.find(x=>x.id===id);if(!item)return;if(this.gold<item.price){this.onToast?.('金币不足');return;}this.gold-=item.price;const v=item.tier,step=item.index%4;switch(item.kind){case'heal':this.hp=Math.min(this.maxHp,this.hp+Math.ceil(this.maxHp*(.18+v*.035)));if(step===2)this.poisonTime=0;break;case'melee':this.attackMultiplier*=1+.018*v;this.baseAttack=Math.round((15+this.cores.reduce((a,c)=>a+c.attack,0))*this.attackMultiplier);if(step===1)this.attackSpeedBonus+=.012*v;break;case'gun':this.attackMultiplier*=1+.012*v;this.baseAttack=Math.round((15+this.cores.reduce((a,c)=>a+c.attack,0))*this.attackMultiplier);this.critBonus+=.004*v;if(this.activeWeapon==='ak')this.attackSpeedBonus+=.01*v;break;case'defense':this.shopHpBonus+=4*v;this.maxHp+=4*v;this.hp=Math.min(this.maxHp,this.hp+4*v);if(step===3)this.moveBonus+=.004*v;break;case'tactical':if(step===0){this.buff='狂暴';this.buffTime=Math.max(this.buffTime,5+v);}else if(step===1){this.poisonTime=0;this.poisonImmune=20+v*5;}else if(step===2){this.hp=Math.min(this.maxHp,this.hp+Math.ceil(this.maxHp*.12));this.invuln=Math.max(this.invuln,1.2);}else{this.critBonus+=.003*v;this.critDamageBonus+=.008*v;}break;}localStorage.setItem('ns_gold',this.gold);this.shopPurchases=(this.shopPurchases||0)+1;localStorage.setItem('ns_shop_purchases',String(this.shopPurchases));this.saveCampaign();this.checkExpandedAchievements('shops',this.shopPurchases);this.onToast?.('购买成功：'+item.name);this.updateUI();}
spawnChest(position){if(this.chest?.group)this.scene.remove(this.chest.group);if(this.bossDrop?.group)this.scene.remove(this.bossDrop.group);const g=new THREE.Group();this.scene.add(g);g.position.set(position.x,0,position.z);const gold=mat('#e9b83e',.25,.8),dark=mat('#80551b',.35,.5);const body=new THREE.Mesh(new THREE.BoxGeometry(1.4,.85,.9),gold);body.position.y=.5;g.add(body);const lid=new THREE.Mesh(new THREE.BoxGeometry(1.48,.3,.96),dark);lid.position.y=1.05;g.add(lid);const glow=new THREE.PointLight('#ffca45',5,9);glow.position.y=1.5;g.add(glow);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.055,8,32),new THREE.MeshBasicMaterial({color:'#ffd85a',transparent:true,opacity:.85}));ring.rotation.x=Math.PI/2;ring.position.y=.06;g.add(ring);this.chest={group:g,opened:false,prompted:false};this.bossDrop=null;}
 spawnCoreDrop(type,position){if(this.bossDrop?.group)this.scene.remove(this.bossDrop.group);if(this.chest?.group)this.scene.remove(this.chest.group);const colors=['#ffca45','#58e8ff','#a5ff62','#bd79ff'],color=colors[type]||'#58e8ff',g=new THREE.Group();g.position.set(position.x,0,position.z);const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.58,1),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.8,metalness:.35,roughness:.18}));orb.position.y=1.15;g.add(orb);const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.045,8,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9}));ring.rotation.x=Math.PI/2;ring.position.y=.08;g.add(ring);const light=new THREE.PointLight(color,4,8);light.position.y=1.2;g.add(light);this.scene.add(g);this.bossDrop={group:g,type,baseY:1.15};}
 pickupChest(){const p=this.player.root.position;if(this.chest&&!this.chest.opened&&p.distanceTo(this.chest.group.position)<=6){this.chest.opened=true;this.awardCore(0);this.onWeaponChest?.(true);this.paused=true;return;}if(this.bossDrop&&p.distanceTo(this.bossDrop.group.position)<=6){const type=this.bossDrop.type;this.scene.remove(this.bossDrop.group);this.bossDrop=null;this.awardCore(type);this.onToast?.('核心已收入背包！按 C 查看并装备');return;}this.onToast?.('靠近发光掉落物后按 E 拾取');}
updateDistricts(){if(!this.citySegments)this.citySegments=[{group:this.world.city,z:0}];if(this.nextCityEdge===undefined)this.nextCityEdge=-120;while(this.player.root.position.z<this.nextCityEdge+60){const g=this.world.city.clone(true);g.position.z=this.nextCityEdge;this.scene.add(g);this.citySegments.push({group:g,z:this.nextCityEdge});this.nextCityEdge-=120;}for(let i=this.citySegments.length-1;i>0;i--){const seg=this.citySegments[i];if(this.player.root.position.z<seg.z-160){this.scene.remove(seg.group);this.citySegments.splice(i,1);}}}
releaseWave(){if(this.swordCharge<3){this.onToast?.('剑气蓄力 '+this.swordCharge+'/3');return;}this.swordCharge=0;const dir=new THREE.Vector3(0,0,-1).applyQuaternion(this.player.root.quaternion).normalize(),origin=this.player.root.position.clone().add(new THREE.Vector3(0,1.25,0)).addScaledVector(dir,1.2);const color=new THREE.Color(this.swordColor);
  const group=new THREE.Group();this.scene.add(group);group.position.copy(origin);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),dir);
  const glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const core=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const shape=new THREE.Shape();shape.moveTo(-.08,-.05);shape.quadraticCurveTo(-1.1,.1,-1.05,1.05);shape.quadraticCurveTo(0,1.72,1.05,1.05);shape.quadraticCurveTo(1.1,.1,.08,-.05);shape.quadraticCurveTo(0,.18,-.08,-.05);
  const blade=new THREE.Mesh(new THREE.ShapeGeometry(shape,24),glow);blade.position.y=-.45;group.add(blade);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(.78,.035,8,48,Math.PI),core);inner.position.y=.35;inner.rotation.z=Math.PI;group.add(inner);
  const streak=new THREE.Mesh(new THREE.PlaneGeometry(.12,1.7),core);streak.position.set(0,.35,.025);group.add(streak);
  for(let i=0;i<18;i++){const spark=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.035,6,6),new THREE.MeshBasicMaterial({color,blending:THREE.AdditiveBlending}));spark.position.set((Math.random()-.5)*1.8,Math.random()*1.5-.3,.05);group.add(spark);}
  this.waves.push({group,dir,life:1.25,hit:new Set(),speed:25,color});this.onToast?.('三连斩蓄满！彩色剑气释放！');this.updateUI();
 }
 clearScreen(){if(this.swordCharge<3){this.onToast?.('清屏能量未满：先完成三次斩击');return;}this.swordCharge=0;for(const e of this.enemies){if(!e.dead)this.damageEnemy(e,9999);}this.hp=this.maxHp;this.burst(this.player.root.position,this.swordColor,36);this.onToast?.('奥义·万象归斩！全屏清除，生命回满');this.updateUI();}
 hitImpact(position,color){const center=position.clone().add(new THREE.Vector3(0,1.25,0));const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.035,6,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));ring.position.copy(center);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(.25,.55,1).normalize());this.scene.add(ring);this.particles.push({mesh:ring,vel:new THREE.Vector3(0,.8,0),life:.22});this.burst(center,color,10);}
  burst(position,color,count){for(let i=0;i<count;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.035+Math.random()*.055,6,6),new THREE.MeshBasicMaterial({color,transparent:true}));m.position.copy(position);this.scene.add(m);this.particles.push({mesh:m,vel:new THREE.Vector3((Math.random()-.5)*12,Math.random()*9,(Math.random()-.5)*12),life:.8});}}
 damageEnemy(e,damage){this.audio.play('hit');const impactColor=this.activeWeapon==='solar'?'#ffd45c':this.activeWeapon==='demon'?'#b86cff':this.activeWeapon==='ak'?'#ffb347':this.swordColor;this.hitImpact(e.model.root.position,impactColor);if(e.boss&&e.weakpointOpen)damage*=1.5;const crit=Math.random()<.1+(this.critBonus||0)+(this.skillCritBonus||0);damage=Math.round(damage*(crit?2+(this.critDamageBonus||0):1)*(1+(this.skillAttackBonus||0)));e.hp=Math.max(0,e.hp-damage);setHealthDisplay(e.model,e.hp,e.maxHp,e.elite?1.28:1.16);if(e.boss)this.onBoss?.({hp:Math.max(0,e.hp),maxHp:e.maxHp,show:e.hp>0,phase:e.enraged?2:1,weakpoint:!!e.weakpointOpen});if(e.hp<=0&&!e.dead){e.dead=true;e.deathTime=.85;this.audio.play('kill');if(e.model.mixer)e.model.mixer.stopAllAction();if(e.boss){this.unlockAchievement('boss_'+(e.bossType||0),'Boss终结者','击败一名区域Boss',60);this.bossActive=false;this.onBoss?.({hp:0,maxHp:e.maxHp,show:false});const forward=new THREE.Vector3(-Math.sin(this.cameraYaw),0,-Math.cos(this.cameraYaw));const drop=this.player.root.position.clone().addScaledVector(forward,2.4);if((e.bossType||0)===0){this.spawnChest(drop);this.onToast?.('绿巨人黄金宝箱已掉落！靠近后按 E 开启');}else{this.spawnCoreDrop(e.bossType||0,drop);this.onToast?.(['','黑蜘蛛核心已掉落！靠近后按 E 拾取','裂地核心已掉落！靠近后按 E 拾取','虚空核心已掉落！靠近后按 E 拾取'][e.bossType]||'BOSS 核心已掉落！靠近后按 E 拾取');}}this.xp+=20;let levelsGained=0;while(this.xp>=100){this.xp-=100;this.level++;this.maxHp+=5;this.hp=Math.min(this.maxHp,this.hp+10);this.attackMultiplier*=1.02;this.skillPoints=(this.skillPoints||0)+1;this.baseAttack=Math.round((15+this.cores.reduce((a,c)=>a+c.attack,0))*this.attackMultiplier);levelsGained++;}localStorage.setItem('ns_level',String(this.level));localStorage.setItem('ns_xp',String(this.xp));if(levelsGained)this.onToast?.('等级提升至 LV.'+String(this.level).padStart(2,'0')+' · 生命上限 +5 · 攻击 +2%');this.kills++;localStorage.setItem('ns_kills',this.kills);this.trackQuest('kills');this.markBestiarySeen(e);this.checkAchievements();this.checkExpandedAchievements('kills',this.kills);if(e.elite){this.eliteKills=(this.eliteKills||0)+1;localStorage.setItem('ns_elite_kills',this.eliteKills);this.checkExpandedAchievements('elites',this.eliteKills);}if(e.boss){this.trackQuest('bosses');this.bossKills=(this.bossKills||0)+1;localStorage.setItem('ns_boss_kills',this.bossKills);this.checkExpandedAchievements('bosses',this.bossKills);}this.rollBuff();this.saveCampaign();this.burst(e.model.root.position,this.swordColor,8);}}
 markBestiarySeen(e){const id=e.boss?['hulk','spider','colossus','reaper'][e.bossType||0]:e.elite?'elite':e.ranged?'shooter':'street';if(!this.bestiarySeen.includes(id)){this.bestiarySeen.push(id);this.saveCampaign();}}
 getAchievementCatalog(){
  const tracks=[
   ['kills','街头清剿','累计击败敌人',i=>i*10,50],
   ['districts','街区征服','推进至街区',i=>i,50],
   ['bosses','巨兽猎手','累计击败Boss',i=>i,50],
   ['shops','军需采购','累计购买商品',i=>i,50],
   ['attacks','刀锋修行','累计发动攻击',i=>i*50,50],
   ['elites','精英终结','累计击败精英敌人',i=>i*2,50]
  ];
  return tracks.flatMap(([type,title,desc,threshold,count])=>Array.from({length:count},(_,n)=>({id:'expanded_'+type+'_'+(n+1),type,title:title+' · '+String(n+1).padStart(2,'0'),desc:desc+' '+threshold(n+1)+' 次',threshold:threshold(n+1),reward:10+Math.floor(n/10)*5})));
 }
 checkExpandedAchievements(type,value){
  for(const a of this.getAchievementCatalog())if(a.type===type&&value>=a.threshold&&!this.achievementRecords.some(r=>r.id===a.id))this.unlockAchievement(a.id,a.title,a.desc,a.reward);
 }
 checkAchievements(){const milestones=[10,25,50,100,250,500,1000,...Array.from({length:Math.max(0,Math.floor((this.kills-1000)/500))},(_,i)=>1500+i*500)];for(const n of milestones){if(this.kills>=n&&!this.achievements.includes(n)){this.achievements.push(n);const reward=n>=500?100:n>=100?35:n>=50?20:10;this.gold+=reward;localStorage.setItem('ns_gold',this.gold);this.onToast?.('成就解锁：击败 '+n+' 名敌人！+'+reward+' 金币');this.onAchievement?.(n);}}if(this.kills>=25)this.unlockAchievement('first_blood_25','街头清道夫','累计击败25名敌人',20);if(this.kills>=500)this.unlockAchievement('veteran_500','百战老兵','累计击败500名敌人',100);localStorage.setItem('ns_achievements',JSON.stringify(this.achievements));}
 unlockAchievement(id,title,desc,reward){if(this.achievementRecords.some(x=>x.id===id))return;const record={id,title,desc,reward,unlockedAt:Date.now()};this.achievementRecords.push(record);this.gold+=reward;localStorage.setItem('ns_gold',this.gold);localStorage.setItem('ns_achievement_records',JSON.stringify(this.achievementRecords));this.onToast?.('新成就：'+title+' · +'+reward+' 金币');this.onAchievement?.(id);}
 rollBuff(){const b=[['无敌',8],['霸体',9],['狂暴',10],['斯安威斯坦',6]][Math.floor(Math.random()*4)];this.buff=b[0];this.buffTime=b[1];}
 buySword(id){const s=SWORDS.find(x=>x.id===id);if(!s)return;if(this.swordId===id){this.onToast?.('已装备这把太刀');return;}if(this.ownedSwords.includes(id)){this.equipSword(id);this.onToast?.('已切换：'+s.name+'太刀');return;}if(this.gold<10){this.onToast?.('金币不足：需要 10 金币');return;}this.gold-=10;this.ownedSwords.push(id);localStorage.setItem('ns_gold',this.gold);localStorage.setItem('ns_owned_swords',JSON.stringify(this.ownedSwords));this.equipSword(id);this.onToast?.('购买并装备：'+s.name+'太刀');this.saveCampaign();this.updateUI();}
 equipSword(id){const s=SWORDS.find(x=>x.id===id);if(!s)return;this.swordId=id;this.swordColor=s.color;this.player.sword.traverse(o=>{if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.height===.78){o.material.emissive.set(s.color);}});localStorage.setItem('ns_sword',id);this.updateUI();}
 updateUI(){const level=Number.isFinite(this.level)&&this.level>0?Math.floor(this.level):1;this.level=THREE.MathUtils.clamp(level,1,9999);if(!Number.isFinite(this.maxHp)||this.maxHp<=0)this.maxHp=100+5*(this.level-1);if(!Number.isFinite(this.hp))this.hp=this.maxHp;this.hp=THREE.MathUtils.clamp(this.hp,0,this.maxHp);if(!Number.isFinite(this.xp))this.xp=0;this.xp=THREE.MathUtils.clamp(Math.floor(this.xp),0,99);const attack=this.activeWeapon==='katana'?Math.round(30*(Number.isFinite(this.attackMultiplier)?this.attackMultiplier:1)*(1+(Number(this.skillAttackBonus)||0))):Math.round((Number(this.baseAttack)||15)*(1+(Number(this.skillAttackBonus)||0)));const attackSpeed=Number.isFinite(1+(this.attackSpeedBonus||0))?(1+(this.attackSpeedBonus||0))*(this.poisonTime>0?.5:1):1;this.onUpdate?.({hp:this.hp,maxHp:this.maxHp,poison:Number(this.poisonTime)||0,cores:this.coreSlots,attack:Number.isFinite(attack)?attack:15,attackSpeed:Number.isFinite(attackSpeed)?attackSpeed:1,crit:10+(Number(this.critBonus)||0)*100+(Number(this.skillCritBonus)||0)*100,critDamage:200+(Number(this.critDamageBonus)||0)*100,xp:this.xp,enemies:this.enemies.filter(e=>!e.dead).length,buff:this.buff,buffTime:Number(this.buffTime)||0,charge:this.swordCharge,gold:this.gold,kills:this.kills,level:this.level,swordId:this.swordId,weapon:this.activeWeapon,owned:this.weaponOwned,district:this.districtProgress});}
 dodge(){if(this.paused||this.dodgeTime>0)return;this.audio.play('dodge');this.dodgeTime=.42;this.invuln=this.unlockedSkills?.includes('dodge')?.7:.5;this.dodgeDir.set(0,0,-1).applyQuaternion(this.player.root.quaternion).normalize();}
 loop=()=>{requestAnimationFrame(this.loop);const raw=this.clock.getDelta();if(this.paused)return;const dt=Math.min(raw,.04);this.update(dt);if(this.world.composer)this.world.composer.render();else this.renderer.render(this.scene,this.camera);};
 update(dt){const p=this.player.root;this.attackTime=Math.max(0,this.attackTime-dt);this.iaidoTime=Math.max(0,this.iaidoTime-dt);this.dodgeTime=Math.max(0,this.dodgeTime-dt);this.invuln=Math.max(0,this.invuln-dt);this.parryWindow=Math.max(0,this.parryWindow-dt);this.comboWindow=Math.max(0,this.comboWindow-dt);this.buffTime=Math.max(0,this.buffTime-dt);if(!this.buffTime)this.buff=null;
  this.timeStop=Math.max(0,this.timeStop-dt);const worldDt=dt*(this.buff==='斯安威斯坦'?.2:1),forward=(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0)+this.mobile.y,side=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+this.mobile.x;const sy=Math.sin(this.cameraYaw),cy=Math.cos(this.cameraYaw),cameraForward=new THREE.Vector3(-sy,0,-cy),cameraRight=new THREE.Vector3(cy,0,-sy),move=cameraRight.multiplyScalar(side).addScaledVector(cameraForward,forward);if(move.lengthSq()>1)move.normalize();const speed=(this.buff==='狂暴'?7.4:5.2)*(this.keys.ShiftLeft||this.keys.ShiftRight?1.45:1)*(this.poisonTime>0?.5:1)*(1+(this.moveBonus||0)+(this.skillMoveBonus||0));
  this.poisonTime=Math.max(0,this.poisonTime-dt);this.poisonImmune=Math.max(0,(this.poisonImmune||0)-dt);if(this.player.hpFill)this.player.hpFill.scale.x=1.16*Math.max(0,this.hp/this.maxHp);this.world.environment?.update(dt,p.position);this.updateDistricts();if(this.chest&&!this.chest.opened&&p.position.distanceTo(this.chest.group.position)<6&&!this.chest.prompted){this.chest.prompted=true;this.onToast?.('黄金宝箱就在附近：按 E 开启武器奖励');}if(this.bossDrop){this.bossDrop.group.rotation.y+=dt*.8;this.bossDrop.group.position.y=.12+Math.sin(performance.now()*.0025)*.12;this.bossDrop.group.children[0].position.y=1.15+Math.sin(performance.now()*.003)*.2;if(p.position.distanceTo(this.bossDrop.group.position)<6&&!this.bossDrop.prompted){this.bossDrop.prompted=true;this.onToast?.('BOSS 核心就在附近：按 E 拾取');}}if(this.dodgeTime>0)this.moveActor(p,this.dodgeDir.clone().multiplyScalar(10*dt),.42);if(move.lengthSq()>.01)this.moveActor(p,move.clone().multiplyScalar(speed*dt),.42);p.position.x=THREE.MathUtils.clamp(p.position.x,-48,48);p.position.z=Math.min(p.position.z,48);p.rotation.y=this.cameraYaw;this.updateEnemyIndicators();this.updateMinimap();
  const walking=move.lengthSq()>.01;this.player.anim+=dt*(walking?11:3);const swing=this.attackTime>0?Math.sin((.42-this.attackTime)/.42*Math.PI):this.iaidoTime>0?1:0;if(this.fpWeapon)this.fpWeapon.rotation.z=this.attackTime>0?-.85*swing:this.iaidoTime>0?-1.5:0;this.player.armR.rotation.x=-swing*1.8;this.player.armL.rotation.x=this.block?-.95:0;this.player.armR.rotation.z=-.15-swing*.45;this.player.armL.rotation.z=.15;this.player.sword.rotation.z=this.block?-.9:(this.attackTime>0?-1.15*swing:this.iaidoTime>0?-2.2:0);if(this.weaponVisual)this.weaponVisual.rotation.z=this.attackTime>0?-1.15*swing:this.iaidoTime>0?-2.2:0;this.player.legL.rotation.x=Math.sin(this.player.anim)*.5*(walking?1:0);this.player.legR.rotation.x=-Math.sin(this.player.anim)*.5*(walking?1:0);
  if(this.player.cloak){const a=this.player.cloak.geo.attributes.position,base=this.player.cloak.base,t=performance.now()*.001;for(let i=0;i<a.count;i++){const x=base[i*3],y=base[i*3+1],n=(1-y/1.38)/2,wave=Math.sin(t*3.2+x*3.5+n*4)*(.025+n*.11)+Math.sin(t*1.8+x*5)*.018;a.setXYZ(i,x,y+Math.sin(t*2.5+x*2)*n*.025,wave+n*.08);}a.needsUpdate=true;this.player.cloak.geo.computeVertexNormals();this.player.cloak.cloak.rotation.z=Math.sin(t*1.8)*.035+(walking?Math.sin(t*11)*.04:0);}
  if(this.timeStop<=0)for(const e of this.enemies)this.updateEnemy(e,worldDt);this.updateBullets(worldDt);this.updateWaves(dt);this.updateParticles(dt);
  const behind=new THREE.Vector3(Math.sin(this.cameraYaw),0,Math.cos(this.cameraYaw)),targetPos=p.position.clone().add(new THREE.Vector3(0,2.3,0)).addScaledVector(behind,this.cameraDistance);targetPos.y+=this.cameraPitch*8;this.camera.position.lerp(targetPos,1-Math.exp(-dt*5));this.camera.position.set(p.position.x,p.position.y+1.62,p.position.z);this.camera.rotation.order='YXZ';this.camera.rotation.y=this.cameraYaw;this.camera.rotation.x=this.cameraPitch;
  if(performance.now()-this.lastUpdate>100){this.updateUI();this.lastUpdate=performance.now();}if(Date.now()-(this.lastSaveAt||0)>15000){this.saveCampaign();this.lastSaveAt=Date.now();}
  if(this.encounterActive&&this.enemies.length>0&&this.enemies.every(e=>e.dead)){this.encounterActive=false;this.encounterCleared=true;this.exitTargetZ=p.position.z-18;this.showAdvanceArrow(p.position.z-1.35);this.onAdvance?.({show:true,district:this.districtNumber});this.onToast?.('街区已清理！沿七彩箭头方向前进');}
  if(this.encounterCleared&&this.advanceArrow){this.advanceArrow.position.x=p.position.x;this.advanceArrow.position.z=p.position.z-1.35;const pulse=.82+Math.sin(performance.now()*.006)*.13;this.advanceArrow.scale.set(pulse,1,pulse);}
  if(this.encounterCleared&&this.exitTargetZ!==undefined&&p.position.z<=this.exitTargetZ&&!this.chest&&!this.bossDrop){this.exitTargetZ=undefined;this.advanceDistrict();}
  if(this.hp<=0&&!this.gameOver){this.hp=0;this.saveCampaign();this.gameOver=true;this.paused=true;document.exitPointerLock?.();document.querySelector('#pauseOverlay').classList.add('hidden');document.querySelector('#gameOverOverlay').classList.remove('hidden');}
 }
initMinimap(){
  this.minimapCanvas=document.querySelector('#miniMap');this.minimapContext=this.minimapCanvas?.getContext('2d')||null;this.lastMinimapUpdate=0;
 }
 updateMinimap(){
  if(!this.minimapContext||performance.now()-this.lastMinimapUpdate<120)return;this.lastMinimapUpdate=performance.now();
  const ctx=this.minimapContext,size=this.minimapCanvas.width,center=size/2,scale=3.05,range=center/scale,p=this.player.root.position;
  ctx.clearRect(0,0,size,size);ctx.fillStyle='rgba(5,13,21,.88)';ctx.fillRect(0,0,size,size);
  ctx.save();ctx.beginPath();ctx.arc(center,center,center-2,0,Math.PI*2);ctx.clip();
  ctx.strokeStyle='rgba(70,125,145,.18)';ctx.lineWidth=1;
  for(let i=-range;i<=range;i+=10){const v=center+i*scale;ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,size);ctx.stroke();ctx.beginPath();ctx.moveTo(0,v);ctx.lineTo(size,v);ctx.stroke();}
  ctx.fillStyle='rgba(112,139,145,.32)';
  for(const seg of this.citySegments||[{z:0}])for(const c of this.world.buildingColliders||[]){
   if(c.type==='circle'){const x=center+(c.x-p.x)*scale,y=center+(c.z+(seg.z||0)-p.z)*scale;if(Math.abs(x-center)<center+10&&Math.abs(y-center)<center+10){ctx.beginPath();ctx.arc(x,y,c.r*scale,0,Math.PI*2);ctx.fill();}}
   else{const x=center+(c.minX-p.x)*scale,y=center+(c.minZ+(seg.z||0)-p.z)*scale,w=(c.maxX-c.minX)*scale,h=(c.maxZ-c.minZ)*scale;if(x<size&&y<size&&x+w>0&&y+h>0)ctx.fillRect(x,y,w,h);}
  }
  for(const enemy of this.enemies){if(enemy.dead||!enemy.model?.root)continue;const dx=enemy.model.root.position.x-p.x,dz=enemy.model.root.position.z-p.z;if(Math.abs(dx)>range||Math.abs(dz)>range)continue;const x=center+dx*scale,y=center+dz*scale;ctx.beginPath();ctx.fillStyle=enemy.boss?'#ff405d':enemy.elite?'#ffb34d':enemy.ranged?'#c38aff':'#52eaff';ctx.arc(x,y,enemy.boss?5.5:enemy.elite?4:2.7,0,Math.PI*2);ctx.fill();if(enemy.boss){ctx.strokeStyle='rgba(255,64,93,.75)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();}}
  ctx.translate(center,center);ctx.rotate(-Math.PI/2-this.cameraYaw);ctx.fillStyle='#eaffff';ctx.strokeStyle='#28e6ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,7);ctx.lineTo(0,4);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.strokeStyle='rgba(111,222,239,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(center,center,center-1,0,Math.PI*2);ctx.stroke();
 }
 initEnemyIndicators(){
  const hud=document.querySelector('#hud');
  if(!hud)return;
  this.enemyIndicatorLayer=document.createElement('div');
  this.enemyIndicatorLayer.id='enemyDirectionIndicators';
  this.enemyIndicatorLayer.setAttribute('aria-hidden','true');
  hud.appendChild(this.enemyIndicatorLayer);
  this.enemyIndicatorNodes=[];
 }
 updateEnemyIndicators(){
  if(!this.enemyIndicatorLayer)return;
  const now=performance.now();
  if(now-(this.lastIndicatorUpdate||0)<90)return;
  this.lastIndicatorUpdate=now;
  const p=this.player.root.position;
  const active=this.enemies.filter(e=>!e.dead&&e.model?.root?.visible!==false)
    .map(e=>({enemy:e,dx:e.model.root.position.x-p.x,dz:e.model.root.position.z-p.z,
      distance:p.distanceTo(e.model.root.position)}))
    .sort((a,b)=>a.distance-b.distance).slice(0,12);
  while(this.enemyIndicatorNodes.length<active.length){
    const node=document.createElement('div');
    node.className='enemy-direction-arrow';
    this.enemyIndicatorLayer.appendChild(node);
    this.enemyIndicatorNodes.push(node);
  }
  for(let i=0;i<this.enemyIndicatorNodes.length;i++){
    const node=this.enemyIndicatorNodes[i],item=active[i];
    if(!item){node.hidden=true;continue;}
    node.hidden=false;
    const worldAngle=Math.atan2(item.dx,-item.dz);
    const relative=Math.atan2(Math.sin(worldAngle-this.cameraYaw),Math.cos(worldAngle-this.cameraYaw));
    const radius=66+(i%3)*5;
    node.style.transform='translate(-50%,-50%) rotate('+relative+'rad) translateY(-'+radius+'px)';
    node.classList.toggle('boss',!!item.enemy.boss);
    node.title=item.enemy.boss?'BOSS':'敌人';
  }
 }
  updateEnemy(e,dt){if(e.dead){const rig=e.model;e.deathTime=Math.max(0,(e.deathTime??.85)-dt);if(rig.bones){if(rig.bones.upperarmR)rig.bones.upperarmR.rotation.z-=dt*1.5;if(rig.bones.upperarmL)rig.bones.upperarmL.rotation.z+=dt*1.5;if(rig.bones.lowerarmR)rig.bones.lowerarmR.rotation.x-=dt*.8;}rig.root.rotation.z=THREE.MathUtils.damp(rig.root.rotation.z,.95,4,dt);rig.root.position.y=Math.max(-.45,rig.root.position.y-dt*.55);if(e.deathTime<=0)rig.root.visible=false;return;}const m=e.model.root,p=this.player.root,delta=p.position.clone().sub(m.position),dist=delta.length(),rig=e.model,phase=performance.now()*.001+e.seed*.73;if(rig.mixer){rig.mixer.update(dt);const desired=dist>1.7?(dist>8?'run':'brisk walk'):'idle';const next=rig.actions?.[desired]||rig.actions?.idle;if(next&&next!==rig.activeAction){rig.activeAction?.fadeOut(.22);next.reset().fadeIn(.22).play();rig.activeAction=next;}if(next===rig.actions?.idle){next.paused=true;next.time=0;}else if(next){next.paused=false;next.timeScale=desired==='run'?1.38:1;}}e.swingTime=Math.max(0,(e.swingTime||0)-dt);if(rig.bones){const swing=e.swingTime>0?Math.sin((.36-e.swingTime)/.36*Math.PI):0,breath=Math.sin(phase*1.35)*.025;if(rig.bones.upperarmR)rig.bones.upperarmR.rotation.x+=(e.ranged?-.72: -swing*1.48)+breath;if(rig.bones.lowerarmR)rig.bones.lowerarmR.rotation.x+=(e.ranged?1.08:-swing*.52);if(rig.bones.upperarmL)rig.bones.upperarmL.rotation.x+=(e.ranged?-.66: swing*.22)+breath*.7;if(rig.bones.lowerarmL&&e.ranged)rig.bones.lowerarmL.rotation.x+=.32;if(rig.bones.upperlegR&&dist<1.7)rig.bones.upperlegR.rotation.x+=Math.sin(phase)*.025;if(rig.bones.upperlegL&&dist<1.7)rig.bones.upperlegL.rotation.x-=Math.sin(phase)*.025;}e.attack-=dt;e.stun=Math.max(0,e.stun-dt);rig.anim+=dt*(e.navBlocked?1.5:dist>2?7:2.2);const stride=Math.sin(rig.anim)*.52;rig.legL.rotation.x=dist>1.7&&!e.navBlocked?stride:Math.sin(phase)*.035;rig.legR.rotation.x=dist>1.7&&!e.navBlocked?-stride:Math.sin(phase+1.2)*.035;rig.root.position.y=Math.abs(Math.sin(phase*1.7))*.025;if(e.stun>0&&!e.boss){rig.armR.rotation.x=THREE.MathUtils.damp(rig.armR.rotation.x,-.5,7,dt);rig.armL.rotation.x=THREE.MathUtils.damp(rig.armL.rotation.x,-.35,7,dt);return;}if(e.boss){this.updateBossEnemy(e,dt,delta,dist,phase);return;}if(e.ranged){m.rotation.y=Math.atan2(-delta.x,-delta.z);rig.armR.rotation.x=THREE.MathUtils.damp(rig.armR.rotation.x,-1.05,5,dt);rig.armL.rotation.x=THREE.MathUtils.damp(rig.armL.rotation.x,-.72,5,dt);if(dist>7){delta.normalize();this.moveEnemyToward(e,delta.clone().normalize().multiplyScalar(Math.min(1.5*dt,dist-6)),e.elite?.78:.42);}if(e.attack<=0&&dist<19){e.attack=2.3+Math.random();rig.armR.rotation.x=-1.42;rig.armR.rotation.z=-.08;this.fireBullet(e);this.onToast?.('敌方射手开火！');}}else if(dist>1.65){delta.normalize();this.moveEnemyToward(e,delta.clone().normalize().multiplyScalar(Math.min(2.1*dt,dist-1.3)),e.elite?.78:.42);m.rotation.y=Math.atan2(-delta.x,-delta.z);rig.armR.rotation.x=THREE.MathUtils.damp(rig.armR.rotation.x,-.18+Math.sin(phase*1.8)*.12,5,dt);rig.armL.rotation.x=THREE.MathUtils.damp(rig.armL.rotation.x,-.12+Math.sin(phase*1.8+1)*.12,5,dt);}else if(e.attack<=0){e.attack=1.4;e.swingTime=.36;rig.armR.rotation.x=-2.05;rig.armR.rotation.z=-.16;rig.armL.rotation.x=.35;this.damagePlayerFromMelee(e);}}
 loadCampaignSave(){
  let saved=null;try{saved=JSON.parse(localStorage.getItem('ns_campaign_save')||'null');}catch{}
  if(!saved||typeof saved!=='object')return;
  this.level=THREE.MathUtils.clamp(Math.floor(Number(saved.level)||this.level),1,9999);this.xp=THREE.MathUtils.clamp(Number(saved.xp)||0,0,99);
  this.districtNumber=THREE.MathUtils.clamp(Math.floor(Number(saved.districtNumber)||1),1,9999);this.districtProgress=this.districtNumber;
  this.gold=Math.max(0,Number(saved.gold)||this.gold);this.kills=Math.max(0,Number(saved.kills)||this.kills);
  this.skillPoints=Math.max(0,Math.floor(Number(saved.skillPoints)||0));this.unlockedSkills=Array.isArray(saved.unlockedSkills)?saved.unlockedSkills:[];
  this.bestiarySeen=Array.isArray(saved.bestiarySeen)?saved.bestiarySeen:[];this.storyClaims=Array.isArray(saved.storyClaims)?saved.storyClaims:[];this.bountyClaims=Array.isArray(saved.bountyClaims)?saved.bountyClaims:[];
  this.weaponOwned={...this.weaponOwned,...(saved.weaponOwned||{})};this.activeWeapon=['katana','solar','demon','ak'].includes(saved.activeWeapon)?saved.activeWeapon:this.activeWeapon;this.ownedSwords=Array.isArray(saved.ownedSwords)?saved.ownedSwords:this.ownedSwords;
  this.shopSpeedBonus=Math.max(0,Number(saved.shopSpeedBonus)||0);this.shopCritBonus=Math.max(0,Number(saved.shopCritBonus)||0);this.shopCritDmgBonus=Math.max(0,Number(saved.shopCritDmgBonus)||0);this.shopHpBonus=Math.max(0,Number(saved.shopHpBonus)||0);this.moveBonus=Math.max(0,Number(saved.moveBonus)||0);
  this.questState=saved.questState&&typeof saved.questState==='object'?saved.questState:null;
  this.coreInventory=(Array.isArray(saved.coreInventory)?saved.coreInventory:[]).filter(x=>x&&typeof x.name==='string').slice(0,40);
  const equipped=Array.isArray(saved.equippedCoreNames)?saved.equippedCoreNames:[];
  this.cores=equipped.map(name=>this.coreInventory.find(c=>c.name===name)).filter(Boolean).slice(0,10);this.coreSlots=Array(10).fill(null);this.cores.forEach((c,i)=>this.coreSlots[i]=c);
  this.attackMultiplier=Number(saved.attackMultiplier)||Math.pow(1.02,this.level-1);
  this.applyCores();this.applySkillBonuses();this.hp=THREE.MathUtils.clamp(Number(saved.hp)||this.maxHp,1,this.maxHp);
 }
 saveCampaign(){
  const data={version:2,level:this.level,xp:this.xp,hp:this.hp,maxHp:this.maxHp,gold:this.gold,kills:this.kills,districtNumber:this.districtNumber,activeWeapon:this.activeWeapon,swordId:this.swordId,skillPoints:this.skillPoints,unlockedSkills:this.unlockedSkills,bestiarySeen:this.bestiarySeen,storyClaims:this.storyClaims,bountyClaims:this.bountyClaims,weaponOwned:this.weaponOwned,ownedSwords:this.ownedSwords,shopSpeedBonus:this.shopSpeedBonus,shopCritBonus:this.shopCritBonus,shopCritDmgBonus:this.shopCritDmgBonus,shopHpBonus:this.shopHpBonus,moveBonus:this.moveBonus,coreInventory:this.coreInventory,equippedCoreNames:this.cores.map(c=>c.name),attackMultiplier:this.attackMultiplier,questState:this.questState,updatedAt:Date.now()};
  try{localStorage.setItem('ns_campaign_save',JSON.stringify(data));}catch(error){console.warn('战役存档失败',error);}
 }
 initQuests(){const day=new Date().toISOString().slice(0,10);if(!this.questState||this.questState.day!==day)this.questState={day,progress:{kills:0,attacks:0,bosses:0},claimed:[]};this.questState.progress??={kills:0,attacks:0,bosses:0};this.questState.claimed??=[];}
 trackQuest(type,amount=1){if(!this.questState)this.initQuests();if(!['kills','attacks','bosses'].includes(type))return;this.questState.progress[type]=Math.max(0,(Number(this.questState.progress[type])||0)+amount);this.saveCampaign();}
 getQuestCatalog(){return [{id:'daily_kills',type:'kills',title:'街区清剿',desc:'今日击败15名敌人',target:15,reward:80},{id:'daily_attacks',type:'attacks',title:'刀锋热身',desc:'今日发动40次攻击',target:40,reward:60},{id:'daily_boss',type:'bosses',title:'巨兽猎手',desc:'今日击败1名Boss',target:1,reward:150}];}
 getLongMissionCatalog(){
  return [
   {id:'story_1',kind:'主线',title:'旧城清扫',desc:'累计击败10名敌人',progress:this.kills,target:10,reward:100,claims:this.storyClaims},
   {id:'story_2',kind:'主线',title:'街区推进',desc:'抵达第3街区',progress:this.districtNumber,target:3,reward:180,claims:this.storyClaims},
   {id:'story_3',kind:'主线',title:'巨兽猎手',desc:'击败首个区域Boss',progress:this.bossKills||0,target:1,reward:220,claims:this.storyClaims},
   {id:'story_4',kind:'主线',title:'精英清除',desc:'累计击败15名精英',progress:this.eliteKills||0,target:15,reward:250,claims:this.storyClaims},
   {id:'story_5',kind:'主线',title:'深入霓虹区',desc:'抵达第6街区',progress:this.districtNumber,target:6,reward:300,claims:this.storyClaims},
   {id:'story_6',kind:'主线',title:'最终防线',desc:'抵达第12街区',progress:this.districtNumber,target:12,reward:600,claims:this.storyClaims},
   {id:'bounty_1',kind:'悬赏',title:'街头通缉令',desc:'累计击败50名敌人',progress:this.kills,target:50,reward:120,claims:this.bountyClaims},
   {id:'bounty_2',kind:'悬赏',title:'精英猎杀令',desc:'累计击败5名精英',progress:this.eliteKills||0,target:5,reward:150,claims:this.bountyClaims},
   {id:'bounty_3',kind:'悬赏',title:'Boss围剿令',desc:'累计击败3名Boss',progress:this.bossKills||0,target:3,reward:300,claims:this.bountyClaims},
   {id:'bounty_4',kind:'悬赏',title:'军需采购单',desc:'累计购买10件商品',progress:this.shopPurchases||0,target:10,reward:180,claims:this.bountyClaims}
  ];
 }
 claimLongMission(id){
  const mission=this.getLongMissionCatalog().find(x=>x.id===id);if(!mission||mission.claims.includes(id)||mission.progress<mission.target)return false;
  if(mission.kind==='主线')this.storyClaims.push(id);else this.bountyClaims.push(id);
  this.gold+=mission.reward;localStorage.setItem('ns_gold',String(this.gold));this.saveCampaign();this.updateUI();this.onToast?.(mission.kind+'完成：'+mission.title+' · +'+mission.reward+' 金币');return true;
 }
 claimQuest(id){const q=this.getQuestCatalog().find(x=>x.id===id);if(!q||this.questState.claimed.includes(id)||(Number(this.questState.progress[q.type])||0)<q.target)return false;this.questState.claimed.push(id);this.gold+=q.reward;localStorage.setItem('ns_gold',String(this.gold));this.saveCampaign();this.updateUI();this.onToast?.('任务完成：'+q.title+' · +'+q.reward+' 金币');return true;}
 unlockSkill(id){
  const skills={edge:{name:'锋刃精通',cost:1},vital:{name:'生命强化',cost:1},swift:{name:'疾风步',cost:1},critical:{name:'弱点洞察',cost:2},dodge:{name:'极限闪避',cost:2},ki:{name:'剑气增幅',cost:2}};
  const skill=skills[id];if(!skill||this.unlockedSkills.includes(id))return false;if(this.skillPoints<skill.cost){this.onToast?.('技能点不足');return false;}
  this.skillPoints-=skill.cost;this.unlockedSkills.push(id);this.applySkillBonuses();this.saveCampaign();this.updateUI();this.onToast?.('技能解锁：'+skill.name);return true;
 }
 applySkillBonuses(){
  const has=id=>this.unlockedSkills.includes(id);this.skillAttackBonus=has('edge')?.08:0;this.skillMoveBonus=has('swift')?.08:0;this.skillCritBonus=has('critical')?.05:0;
  this.maxHp=100+5*((this.level||1)-1)+(this.cores||[]).reduce((a,c)=>a+(Number(c.hp)||0),0)+(this.shopHpBonus||0)+(has('vital')?20:0);
  this.hp=Math.min(Number.isFinite(this.hp)?this.hp:this.maxHp,this.maxHp);this.baseAttack=Math.round((15+(this.cores||[]).reduce((a,c)=>a+(Number(c.attack)||0),0))*this.attackMultiplier);
 }
 updateBossEnemy(e,dt,delta,dist,phase){
  const root=e.model.root,rig=e.model;root.rotation.y=Math.atan2(-delta.x,-delta.z);
  const ratio=e.hp/Math.max(1,e.maxHp);
  if(ratio<=.5&&!e.enraged){e.enraged=true;e.phase=2;e.attack=Math.min(e.attack,.65);if(e.bossType!==0)root.scale.multiplyScalar(1.04);for(const light of rig.bossLights||[])light.intensity*=1.35;this.onToast?.('BOSS进入第二阶段！攻击更加猛烈，弱点暴露窗口缩短！');}
  const playerSpeed=(this.buff==='狂暴'?7.4:5.2)*(this.keys.ShiftLeft||this.keys.ShiftRight?1.45:1)*(this.poisonTime>0?.5:1)*(1+(this.moveBonus||0)+(this.skillMoveBonus||0)),bossSpeed=playerSpeed*.75;
  const stop=e.spider?4.8:e.bossType===0?3.8:2.8,toward=delta.clone().setY(0);
  // Boss holds its attack distance instead of orbiting and reversing around the player.
  if(toward.lengthSq()>.0001&&dist>stop+.08){toward.normalize();this.moveEnemyToward(e,toward.multiplyScalar(Math.min(bossSpeed*dt,dist-stop)),e.spider?1.35:e.bossType===0?1.05:.95);}
  rig.anim=(rig.anim||0)+dt*(dist>stop?5.2:2.2);const stride=Math.sin(rig.anim)*.32;if(rig.legL)rig.legL.rotation.x=stride;if(rig.legR)rig.legR.rotation.x=-stride;
  if(rig.armL)rig.armL.rotation.x=THREE.MathUtils.damp(rig.armL.rotation.x,Math.sin(phase*1.6)*.08,4,dt);if(rig.armR)rig.armR.rotation.x=THREE.MathUtils.damp(rig.armR.rotation.x,Math.sin(phase*1.6+1)*.08,4,dt);
  if(e.spider&&rig.legs)for(const leg of rig.legs){const a=leg.userData.phase||0;leg.rotation.z=Math.sin(phase*4+a)*.13;leg.rotation.x=Math.cos(phase*4+a)*.08;}
  e.weakpointOpen=false;const cadence=e.enraged?.72:1;
  if(e.bossType===0){
   if(e.stompTime>0){e.stompTime=Math.max(0,e.stompTime-dt);const elapsed=1.22-e.stompTime,lift=elapsed<.48?THREE.MathUtils.smoothstep(elapsed,0,.48):elapsed<.72?1-THREE.MathUtils.smoothstep(elapsed,.48,.72):0,leg=rig.legR||rig.legL,other=rig.legL;e.weakpointOpen=elapsed<.7;if(leg)leg.rotation.x=-1.05*lift;if(other&&other!==leg)other.rotation.x=.18*lift;if(elapsed>=.7&&!e.stompHit){e.stompHit=true;this.hulkStomp(e);}if(e.stompTime===0){if(leg)leg.rotation.x=0;if(other&&other!==leg)other.rotation.x=0;}}
   else if(dist<5.8&&e.attack<=0){e.attack=2.7*cadence;e.stompTime=1.22;e.stompHit=false;e.weakpointOpen=true;const liftedLeg=rig.legR||rig.legL;if(liftedLeg)liftedLeg.rotation.x=-.08;this.onToast?.('绿巨人抬腿蓄力！胸口弱点暴露，准备躲避踩踏！');}
   rig.armL.rotation.x=THREE.MathUtils.damp(rig.armL.rotation.x,-.35,3,dt);rig.armR.rotation.x=THREE.MathUtils.damp(rig.armR.rotation.x,.35,3,dt);
  }else if(e.spider){
   if(e.webWindup>0){e.webWindup=Math.max(0,e.webWindup-dt);e.weakpointOpen=true;if(e.webWindup===0){this.spiderWeb(e);e.weakpointOpen=false;}}
   else if(e.attack<=0){e.attack=2.8*cadence;e.webWindup=.62;this.onToast?.('黑蜘蛛抬头蓄力吐网！腹部核心暴露！');}
  }else if(e.bossType===3){
   if(e.volleyWindup>0){e.volleyWindup=Math.max(0,e.volleyWindup-dt);e.weakpointOpen=true;rig.armL.rotation.x=-.85;rig.armR.rotation.x=-.85;if(e.volleyWindup===0){this.fireBullet(e);this.fireBullet(e);e.weakpointOpen=false;this.onToast?.('虚空收割者：双重虚空弹！');}}
   else if(e.attack<=0&&dist<13){e.attack=2.1*cadence;e.volleyWindup=.55;this.onToast?.('虚空收割者凝聚虚空能量！核心短暂暴露！');}
  }else{
   if(e.slamWindup>0){e.slamWindup=Math.max(0,e.slamWindup-dt);e.weakpointOpen=true;rig.armL.rotation.x=-1.15;rig.armR.rotation.x=-1.15;if(e.slamWindup===0){this.bossSlam(e);e.weakpointOpen=false;}}
   else if(e.attack<=0&&dist<5.2){e.attack=3.2*cadence;e.slamWindup=.72;this.onToast?.('裂地巨像举起双臂蓄力！胸前裂隙弱点暴露！');}
  }
  if(e._lastWeakpoint!==e.weakpointOpen||e._lastPhase!==(e.enraged?2:1)){e._lastWeakpoint=e.weakpointOpen;e._lastPhase=e.enraged?2:1;this.onBoss?.({hp:e.hp,maxHp:e.maxHp,show:true,phase:e._lastPhase,weakpoint:e.weakpointOpen});}
 }
 hulkStomp(e){
  const center=e.model.root.position.clone(),ring=new THREE.Mesh(new THREE.TorusGeometry(5.6,.25,10,56),new THREE.MeshBasicMaterial({color:'#a5ff68',transparent:true,opacity:.95,depthWrite:false}));
  ring.rotation.x=Math.PI/2;ring.position.set(center.x,.14,center.z);this.scene.add(ring);this.particles.push({mesh:ring,vel:new THREE.Vector3(),life:.8});
  const distance=this.player.root.position.distanceTo(center);if(distance<5.6&&this.invuln<=0&&!this.block&&this.buff!=='无敌'&&this.buff!=='霸体')this.hp=Math.max(0,this.hp-38*(e.damageMultiplier||1)*(e.enraged?1.25:1));
  this.onToast?.(distance<5.6?'绿巨人重踏命中！':'绿巨人重踏落空！');
 }
 damagePlayerFromMelee(e){if(this.invuln<=0&&!this.block&&this.buff!=='无敌'&&this.buff!=='霸体')this.hp=Math.max(0,this.hp-(e.damage||(e.elite?18:8)));this.onToast?.('敌人挥拳攻击！');}
 bossSlam(e){e.swingTime=.48;const center=e.model.root.position.clone();const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.22,8,48),new THREE.MeshBasicMaterial({color:'#b4ff6a',transparent:true,opacity:.9}));ring.rotation.x=Math.PI/2;ring.position.set(center.x,.18,center.z);this.scene.add(ring);this.particles.push({mesh:ring,vel:new THREE.Vector3(0,0,0),life:.65});if(this.player.root.position.distanceTo(center)<7&&this.invuln<=0&&!this.block&&this.buff!=='无敌'&&this.buff!=='霸体')this.hp=Math.max(0,this.hp-(e.bossType===2?36:e.bossType===3?42:28)*(e.damageMultiplier||1)*(e.enraged?1.25:1));this.onToast?.(e.bossType===2?'裂地巨像：震地重锤！':'绿巨人：地面重拳！');}
 fireBullet(e){const start=e.model.gun?e.model.gun.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.02,-.32)):e.model.root.position.clone().add(new THREE.Vector3(0,1.35,0)),target=this.player.root.position.clone().add(new THREE.Vector3(0,1.1,0)),dir=target.sub(start).normalize(),b=new THREE.Mesh(new THREE.SphereGeometry(.075,8,8),mat('#ffb45d',.25,.6));b.position.copy(start);b.material.emissive=new THREE.Color('#ff6b24');b.material.emissiveIntensity=1.5;this.scene.add(b);this.bullets.push({mesh:b,vel:dir.multiplyScalar(13),life:3,source:e,damage:e.boss?22*(e.damageMultiplier||1)*(e.enraged?1.25:1):e.elite?16:12});}
 updateBullets(dt){for(let i=this.bullets.length-1;i>=0;i--){const b=this.bullets[i];b.life-=dt;b.mesh.position.addScaledVector(b.vel,dt);if(b.life<=0){this.scene.remove(b.mesh);this.bullets.splice(i,1);continue;}const to=this.player.root.position.clone().add(new THREE.Vector3(0,1.1,0)).sub(b.mesh.position);if(to.length()<.65){if(this.parryWindow>0){b.vel.copy(new THREE.Vector3(0,0,-1).applyQuaternion(this.player.root.quaternion).multiplyScalar(23));b.source=null;this.parryWindow=0;this.onToast?.('完美弹反！');continue;}if(this.block||this.buff==='无敌'||this.buff==='霸体'||this.invuln>0){this.scene.remove(b.mesh);this.bullets.splice(i,1);continue;}if(b.web){if(Math.random()<.5&&!(this.poisonImmune>0)){this.poisonTime=8;this.onToast?.('蛛网毒素侵蚀：攻速与移速降低50%！');}else this.onToast?.('蛛网命中！');}this.hp=Math.max(0,this.hp-(b.damage||(b.web?16:12)));this.scene.remove(b.mesh);this.bullets.splice(i,1);continue;}if(!b.source){for(const e of this.enemies){if(!e.dead&&b.mesh.position.distanceTo(e.model.root.position.clone().add(new THREE.Vector3(0,1,0)))<.6){this.damageEnemy(e,35);this.scene.remove(b.mesh);this.bullets.splice(i,1);break;}}}}}
 updateWaves(dt){for(let i=this.waves.length-1;i>=0;i--){const w=this.waves[i];w.life-=dt;w.group.position.addScaledVector(w.dir,w.speed*dt);const growth=1+(.18*(1-w.life));if(w.baseScale)w.group.scale.copy(w.baseScale).multiplyScalar(growth);else w.group.scale.setScalar(growth);w.group.rotation.z+=dt*1.4;for(const e of this.enemies){if(e.dead||w.hit.has(e))continue;const d=e.model.root.position.distanceTo(w.group.position);if(d<2.2){w.hit.add(e);this.damageEnemy(e,(w.damage??90)*(this.unlockedSkills?.includes('ki')?1.25:1));e.stun=1;}}if(w.life<=0){this.scene.remove(w.group);this.waves.splice(i,1);}}}
 updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.mesh.position.addScaledVector(p.vel,dt);p.vel.y-=8*dt;p.mesh.scale.multiplyScalar(.97);if(p.life<=0){this.scene.remove(p.mesh);this.particles.splice(i,1);}}}
}
export {SWORDS};

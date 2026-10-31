import * as THREE from 'three';

const WEATHER = ['clear','rain','snow','fog'];
const clamp01 = v => THREE.MathUtils.clamp(v,0,1);
const smooth = (a,b,x) => { const t=clamp01((x-a)/(b-a)); return t*t*(3-2*t); };

export class EnvironmentSystem {
  constructor(scene,camera,hemi,sun) {
    this.scene=scene;this.camera=camera;this.hemi=hemi;this.sun=sun;
    this.time=Number(localStorage.getItem('ns_world_time') ?? 17);
    this.weather=localStorage.getItem('ns_world_weather') || 'clear';
    if(!WEATHER.includes(this.weather))this.weather='clear';
    this.rainCount=420;this.snowCount=260;
    this.rainPositions=new Float32Array(this.rainCount*6);
    this.snowPositions=new Float32Array(this.snowCount*3);
    for(let i=0;i<this.rainCount;i++)this.resetRain(i,true);
    for(let i=0;i<this.snowCount;i++)this.resetSnow(i,true);
    const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));
    this.rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#9bcfff',transparent:true,opacity:.52}));
    this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);
    const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(this.snowPositions,3));
    this.snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:'#eaf7ff',size:.085,transparent:true,opacity:.9,sizeAttenuation:true}));
    this.snow.frustumCulled=false;this.snow.visible=false;scene.add(this.snow);
    this.apply();
  }
  resetRain(i,initial=false){
    const x=(Math.random()-.5)*34,z=(Math.random()-.5)*34,y=initial?Math.random()*18:14+Math.random()*5;
    const n=i*6;this.rainPositions[n]=x;this.rainPositions[n+1]=y;this.rainPositions[n+2]=z;
    this.rainPositions[n+3]=x-.12;this.rainPositions[n+4]=y-.72;this.rainPositions[n+5]=z;
  }
  resetSnow(i,initial=false){
    const n=i*3;this.snowPositions[n]=(Math.random()-.5)*32;this.snowPositions[n+1]=initial?Math.random()*16:13+Math.random()*4;this.snowPositions[n+2]=(Math.random()-.5)*32;
  }
  setTime(hour){this.time=THREE.MathUtils.clamp(Number(hour)||0,0,23.99);localStorage.setItem('ns_world_time',String(this.time));this.apply();}
  setWeather(weather){if(!WEATHER.includes(weather))return;this.weather=weather;localStorage.setItem('ns_world_weather',weather);this.apply();}
  apply(){
    const h=this.time,day=smooth(5.1,8,h)*(1-smooth(17.1,20.2,h));
    const sunrise=Math.max(0,1-Math.abs(h-6.3)/2.3),sunset=Math.max(0,1-Math.abs(h-18.2)/2.5),twilight=Math.max(sunrise,sunset);
    const sky=new THREE.Color('#050b19').lerp(new THREE.Color('#7da9c8'),day*.72).lerp(new THREE.Color('#d87955'),twilight*.32);
    const ground=new THREE.Color('#080e19').lerp(new THREE.Color('#34424b'),day*.65);
    if(this.weather==='fog'){sky.lerp(new THREE.Color('#a0a9ad'),.48);ground.lerp(new THREE.Color('#78858a'),.55);}
    if(this.weather==='rain'){sky.multiplyScalar(.68);ground.multiplyScalar(.82);}
    if(this.weather==='snow'){sky.lerp(new THREE.Color('#a8c8dc'),.3);ground.lerp(new THREE.Color('#9eabb4'),.35);}
    this.scene.background.copy(sky);
    if(this.scene.fog){this.scene.fog.color.copy(sky);this.scene.fog.density=this.weather==='fog'?.027:this.weather==='rain'?.014:this.weather==='snow'?.011:.0065+(1-day)*.003;}
    this.hemi.color.copy(new THREE.Color('#a8c9e5').lerp(new THREE.Color('#e4d7c0'),day*.55));
    this.hemi.groundColor.copy(ground);this.hemi.intensity=.22+day*.72;
    const angle=(h/24)*Math.PI*2-Math.PI/2;
    this.sun.position.set(Math.cos(angle)*34,Math.max(3,Math.sin(angle)*42),18);
    this.sun.intensity=.12+day*1.55;
    this.sun.color.set(this.weather==='snow'?'#dcecff':this.weather==='rain'||this.weather==='fog'?'#a9bac9':twilight>.25?'#ffbd88':'#b8d8ff');
    this.rain.visible=this.weather==='rain';this.snow.visible=this.weather==='snow';
    this.rain.material.opacity=this.weather==='rain'?.58:0;
  }
  update(dt,center){
    if(this.weather==='rain'){
      for(let i=0;i<this.rainCount;i++){const n=i*6;this.rainPositions[n]+=dt*.7;this.rainPositions[n+1]-=dt*19;this.rainPositions[n+2]+=(center?.z||0)*0;if(this.rainPositions[n+1]<0)this.resetRain(i);}
      this.rain.position.set(center?.x||0,0,center?.z||0);this.rain.geometry.attributes.position.needsUpdate=true;
    }else if(this.weather==='snow'){
      for(let i=0;i<this.snowCount;i++){const n=i*3;this.snowPositions[n]+=Math.sin(performance.now()*.0005+i)*dt*.22;this.snowPositions[n+1]-=dt*(.7+(i%7)*.12);if(this.snowPositions[n+1]<0)this.resetSnow(i);}
      this.snow.position.set(center?.x||0,0,center?.z||0);this.snow.geometry.attributes.position.needsUpdate=true;
    }
  }
  dispose(){this.scene.remove(this.rain,this.snow);this.rain.geometry.dispose();this.rain.material.dispose();this.snow.geometry.dispose();this.snow.material.dispose();}
}

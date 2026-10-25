import * as T from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Shared families keep the PMREM cache bounded even when cycling all hazard maps.
const yard = { zenith:'#668eac', horizon:'#e5dec0', lower:'#717d68', fog:'#c3d3e4', fogRange:[36,100], sun:[-18,28,16], key:'#fff0cd', power:2.4, fill:'#b9d5ea', bounce:'#737d88', ambient:.65, exposure:1.05, environment:.65 };
const city = { ...yard, zenith:'#527f9d', horizon:'#edc8a0', lower:'#435c68', fog:'#bdcbdc', fogRange:[65,185], sun:[-24,23,-18], key:'#ffe0ad', power:2.8, fill:'#afcfe8', bounce:'#526777', ambient:.65, exposure:1.05, environment:.75 };
export const ENVIRONMENTS = {
  yard,
  lava:{...yard,zenith:'#120e16',horizon:'#47252a',lower:'#a9380c',fog:'#492c30',fogRange:[38,110],sun:[-18,30,12],key:'#ffdab5',power:2.1,fill:'#b6bdce',bounce:'#ff5017',ambient:1.1,exposure:1,environment:.5,indoor:true},
  sumo:{...yard, fogRange:[100,250]},
  skyline:city,
  twinspire:{...city, horizon:'#f0cfb6', fog:'#c7d2e2', sun:[-28,25,-12]},
  station:{...city, zenith:'#658da8', horizon:'#e2e8f0', key:'#fff1db', sun:[-16,32,18], power:2.3},
  mountain:{...yard, zenith:'#779fc6', horizon:'#e0e8ef', lower:'#7f94ac', fog:'#cbd9e7', fogRange:[40,140], sun:[-18,30,-14], key:'#fff0cb', power:2.1, bounce:'#798b91', environment:.7},
  ice:{...yard, zenith:'#709fc5', horizon:'#e3eff3', fog:'#d3e6ed', key:'#f1f7ff', bounce:'#7a9aa9', environment:.85},
  industrial:{...yard, zenith:'#627d95', horizon:'#d8c9b0', fog:'#c6ceda', bounce:'#666c71', environment:.7},
  piano:{...yard, zenith:'#111725', horizon:'#252633', lower:'#14131c', fog:'#20212c', fogRange:[160,400], sun:[-22,40,24], key:'#ffe2b0', power:2.8, fill:'#a0b8ec', bounce:'#49405a', ambient:.5, exposure:1, environment:.65, indoor:true},
};
export const QUALITY = { low:{pixelRatio:1,shadowSize:1024}, medium:{pixelRatio:1.5,shadowSize:2048}, high:{pixelRatio:2,shadowSize:2048} };
export function environmentKey(id) {
  return ENVIRONMENTS[id] ? id : id === 'conveyor' ? 'industrial' : 'yard';
}

// Piano keeps a dark studio backdrop; outdoor maps use r180's analytic
// Rayleigh/Mie scattering sky, shared by the visible dome and cached PMREM.
function indoorMaterial(p, visible = false) {
  return new T.ShaderMaterial({ side:T.BackSide, depthWrite:false, fog:false,
    uniforms:{displayHaze:{value:visible?1:0},zenith:{value:new T.Color(p.zenith)},horizon:{value:new T.Color(p.horizon)},haze:{value:new T.Color(p.fog)},lower:{value:new T.Color(p.lower)},sunColor:{value:new T.Color(p.key)},sunDirection:{value:new T.Vector3(...p.sun).normalize()},indoor:{value:p.indoor?1:0}},
    vertexShader:'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;
      uniform vec3 zenith,horizon,haze,lower,sunColor,sunDirection; uniform float indoor,displayHaze;
      void main(){ vec3 d=normalize(direction); float h=d.y;
        vec3 c=mix(horizon,zenith,pow(max(h,0.),.55));
        c=mix(c,lower,smoothstep(0.,.5,-h));
        c=mix(c,haze,1.-smoothstep(0.,.15,abs(h)));
        if(displayHaze>.5)c=mix(c,haze,1.-smoothstep(0.,.15,h));
        float s=max(dot(d,sunDirection),0.);
        c+=sunColor*(pow(s,18.)*.35+pow(s,512.)*3.)*(1.-indoor);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
}

function skyMaterial(p, visible = false) {
  if(p.indoor)return indoorMaterial(p,visible);
  const shader=Sky.SkyShader,uniforms=T.UniformsUtils.clone(shader.uniforms);
  uniforms.turbidity.value=p===ENVIRONMENTS.mountain?3:2;
  uniforms.rayleigh.value=2.2;
  uniforms.mieCoefficient.value=.003;
  uniforms.mieDirectionalG.value=.78;
  uniforms.sunPosition.value=new T.Vector3(...p.sun).normalize().multiplyScalar(450000);
  uniforms.radianceScale={value:visible?1:.35};
  uniforms.horizonColor={value:new T.Color(p.fog)};
  uniforms.groundColor={value:new T.Color(visible?p.fog:'#68798d')};
  const fragmentShader=shader.fragmentShader
    .replace('uniform float mieDirectionalG;', `uniform float mieDirectionalG;
      uniform vec3 horizonColor,groundColor; uniform float radianceScale;
      float cloudNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        vec2 k=vec2(127.1,311.7);
        float a=fract(sin(dot(i,k))*43758.5453);
        float b=fract(sin(dot(i+vec2(1,0),k))*43758.5453);
        float c=fract(sin(dot(i+vec2(0,1),k))*43758.5453);
        float d=fract(sin(dot(i+vec2(1,1),k))*43758.5453);
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }`)
    .replace('gl_FragColor = vec4( retColor, 1.0 );', `
      // Thin, broken high clouds: three noise octaves, no raymarch or extra pass.
      vec2 cloudUV=direction.xz/max(direction.y+.22,.08)*2.4;
      float cloud=cloudNoise(cloudUV)*.57+cloudNoise(cloudUV*2.03)*.29+cloudNoise(cloudUV*4.07)*.14;
      cloud=smoothstep(.57,.79,cloud)*smoothstep(.015,.18,direction.y)*.38;
      retColor=mix(retColor,vec3(.88,.92,.98),cloud);
      // Match distant fog below the horizon, without the old olive lower dome.
      retColor=mix(horizonColor,retColor,smoothstep(-.035,.14,direction.y));
      retColor=mix(retColor,groundColor,smoothstep(.08,.65,-direction.y));
      gl_FragColor=vec4(retColor*radianceScale,1.);`);
  return new T.ShaderMaterial({uniforms,vertexShader:shader.vertexShader,fragmentShader,side:T.BackSide,depthWrite:false,fog:false});
}

// Fit in light space, once per arena identity. Include full piano case, moving
// platform travel and airborne fighters, but exclude the distant city and valley.
export function fitSunShadow(sun, arena) {
  let minX=-12,maxX=12,minZ=-10,maxZ=10,maxY=8;
  for(const p of arena.pieces) {
    minX=Math.min(minX,p.x-p.hw);maxX=Math.max(maxX,p.x+p.hw);
    minZ=Math.min(minZ,p.z-p.hd);maxZ=Math.max(maxZ,p.z+p.hd);
    maxY=Math.max(maxY,p.y+7);
  }
  const margin=arena.id==='platforms'?8:3;
  minX-=margin;maxX+=margin;minZ-=margin;maxZ+=margin;
  const center=new T.Vector3((minX+maxX)/2,0,(minZ+maxZ)/2);
  sun.position.normalize().multiplyScalar(100).add(center);
  sun.target.position.copy(center);sun.target.updateMatrixWorld();sun.updateMatrixWorld();
  const camera=sun.shadow.camera;camera.position.copy(sun.position);camera.up.copy(sun.up);camera.lookAt(center);camera.updateMatrixWorld();
  const bounds=new T.Box3();
  for(const x of [minX,maxX])for(const y of [-3,maxY])for(const z of [minZ,maxZ]) bounds.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  Object.assign(camera,{left:bounds.min.x,right:bounds.max.x,bottom:bounds.min.y,top:bounds.max.y,near:Math.max(.1,-bounds.max.z-5),far:-bounds.min.z+5});
  camera.updateProjectionMatrix();
}

export function createEnvironment(scene, renderer, sun, hemisphere) {
  const generator=new T.PMREMGenerator(renderer), cache=new Map();
  const geometry=new T.SphereGeometry(220,32,16), sky=new T.Mesh(geometry);
  sky.name='Atmosphere sky';sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);scene.background=null;
  let current=null, currentArena=null;
  function reflection(p) {
    const source=new T.Scene(), material=skyMaterial(p), dome=new T.Mesh(geometry,material);source.add(dome);
    const extras=[];
    // Large warm/cool studio softboxes give indoor lacquer and metal reflection
    // detail without adding shadow lights or showing an outdoor sky on Piano.
    if(p.indoor)for(const [x,y,z,w,h,color,intensity] of [[-45,55,10,40,22,'#ffe0aa',5],[40,25,-25,18,45,'#a5c4ff',3]]) {
      const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color,side:T.DoubleSide}));
      m.material.color.multiplyScalar(intensity);m.position.set(x,y,z);m.lookAt(0,0,0);source.add(m);extras.push(m);
    }
    // r180 supports the size option on fromScene; keep captures modest and lazy.
    const target=generator.fromScene(source,.04,.1,300,{size:128});
    material.dispose();for(const m of extras){m.geometry.dispose();m.material.dispose();}
    return target;
  }
  return {
    apply(arena,camera) {
      const key=environmentKey(arena.id),p=ENVIRONMENTS[key];
      if(key!==current) {
        sky.material?.dispose();sky.material=skyMaterial(p,true);
        if(!cache.has(key))cache.set(key,reflection(p));
        scene.environment=cache.get(key).texture;scene.environmentIntensity=p.environment;
        scene.fog=new T.Fog(p.fog,...p.fogRange);
        renderer.toneMappingExposure=p.exposure;
        sun.color.set(p.key);sun.intensity=p.power;sun.position.set(...p.sun);
        hemisphere.color.set(p.fill);hemisphere.groundColor.set(p.bounce);hemisphere.intensity=p.ambient;
        current=key;currentArena=null;
      }
      if(currentArena!==arena){sun.position.set(...p.sun);fitSunShadow(sun,arena);currentArena=arena;}
      // A camera-centered dome always stays inside the existing 500m far plane.
      sky.position.copy(camera.position);
    },
    get cacheSize(){return cache.size;},
    dispose(){for(const target of cache.values())target.dispose();cache.clear();generator.dispose();geometry.dispose();sky.material.dispose();scene.remove(sky);scene.environment=null;},
  };
}

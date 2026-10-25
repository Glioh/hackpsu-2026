import * as T from 'three';

// Tiny shared data textures, deliberately subtle at gameplay distance. They never
// alter color/team markings and use linear data sampling (no sRGB conversion).
let grain;
export function surfaceGrain() {
  if(grain)return grain;
  const size=64,data=new Uint8Array(size*size*4);let seed=17;
  for(let i=0;i<size*size;i++) {seed=(seed*1664525+1013904223)>>>0;const v=185+(seed>>>27);data.set([v,v,v,255],i*4);}
  grain=new T.DataTexture(data,size,size);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.magFilter=T.LinearFilter;grain.minFilter=T.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.repeat.set(5,5);grain.needsUpdate=true;
  return grain;
}
export function enrichMaterials(root) {
  root.traverse(node=>{
    if(!node.isMesh)return;
    for(const m of Array.isArray(node.material)?node.material:[node.material]) {
      if(!m?.isMeshStandardMaterial||m.userData.surfaceEnriched)continue;
      m.userData.surfaceEnriched=true;
      // Preserve authored lacquer, metals, glass, maps, alpha and sightline state.
      if(m.metalness<.5 && m.roughness>=.65 && !m.roughnessMap) {
        m.roughnessMap=surfaceGrain();
        // Subtle tactile grain catches the key/rim on otherwise default matte surfaces.
        // Authored normal/bump maps, glass and polished metal retain their finish.
        if(!m.normalMap && !m.bumpMap && !m.transparent) {m.bumpMap=surfaceGrain();m.bumpScale=.035;}
        m.needsUpdate=true;
      }
    }
  });
}

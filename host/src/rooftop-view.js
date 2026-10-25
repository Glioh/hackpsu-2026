import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCity} from './rooftop-city.js';
import {createRooftopVisibility} from './rooftop-visibility.js';

export function createRooftopView(scene) {
  const root=new T.Group();root.name='Skyline environment';root.visible=false;scene.add(root);
  let started=false, visibility=null;
  return (active,fighters,camera)=>{
    root.visible=active;
    if(active && visibility && camera)visibility(fighters,camera);
    if(!active||started)return;
    started=true;
    root.add(createCity());
    new GLTFLoader().load('/host/assets/maps/skyline.glb',gltf=>{
      gltf.scene.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});root.add(gltf.scene);
      visibility=createRooftopVisibility(gltf.scene);
    },undefined,error=>{console.error('Skyline model failed to load',error);started=false;});
  };
}

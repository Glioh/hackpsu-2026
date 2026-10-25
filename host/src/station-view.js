import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createRooftopVisibility} from './rooftop-visibility.js';

export function createStationView(scene){
  const root=new T.Group();root.name='Crossline station';root.visible=false;scene.add(root);
  const trains=[],signals=[],signalMaterials=[];let started=false,visibility;
  return (arena,fighters,camera)=>{
    root.visible=arena.id==='station';if(!root.visible)return;
    if(!started){
      started=true;
      new GLTFLoader().load('/host/assets/maps/station.glb',gltf=>{
        gltf.scene.traverse(node=>{
          if(node.isMesh)node.castShadow=node.receiveShadow=true;
          if(Number.isInteger(node.userData.stationTrain))trains[node.userData.stationTrain]=node;
          if(Number.isInteger(node.userData.stationSignal)){node.material=node.material.clone();signals[node.userData.stationSignal]=node;signalMaterials[node.userData.stationSignal]=node.material;}
        });
        root.add(gltf.scene);visibility=createRooftopVisibility(gltf.scene);
      },undefined,error=>{console.error('Station model failed to load',error);started=false;});
    }
    arena.trains.forEach((state,i)=>{
      if(trains[i]){trains[i].visible=state.passing;trains[i].position.x=state.x;}
      if(signals[i]){
        const color=state.warning?'#ffb64d':state.passing?'#ee6452':'#75d9b4';
        signals[i].material.color.set(color);signalMaterials[i].color.set(color);
      }
    });
    if(visibility&&camera)visibility(fighters,camera);
  };
}

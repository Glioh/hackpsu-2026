import {createTwinspire} from './twinspire-model.js';
import {createRooftopVisibility} from './rooftop-visibility.js';

export function createTwinspireView(scene) {
  const {root}=createTwinspire({includePlayers:false});
  root.visible=false;scene.add(root);
  const visibility=createRooftopVisibility(root);
  return (active,fighters=[],camera)=>{
    root.visible=active;
    if(active&&camera)visibility(fighters,camera);
  };
}

import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createStation} from './scene.mjs';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const {root,trains}=createStation();trains.forEach((t,i)=>{t.visible=true;t.position.x=i?8:-8;});
const data=await new GLTFExporter().parseAsync(root,{binary:true});
await writeFile(new URL('./station.glb',import.meta.url),Buffer.from(data));
console.log(`Exported station.glb (${data.byteLength} bytes)`);

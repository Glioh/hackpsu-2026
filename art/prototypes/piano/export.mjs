import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createPiano} from './scene.mjs';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const {root}=createPiano();
const data=await new GLTFExporter().parseAsync(root,{binary:true});
await writeFile(new URL('./piano.glb',import.meta.url),Buffer.from(data));
console.log(`Exported piano.glb (${data.byteLength} bytes)`);

import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createFighter } from '../host/src/characters.js';
// GLTFExporter uses this browser API to serialize its binary buffer.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();}); }
};
await mkdir(new URL('../host/models/',import.meta.url),{recursive:true});
for(let i=0;i<2;i++) {
 const {group,spec}=createFighter(i);group.updateMatrixWorld(true);
 const binary=await new GLTFExporter().parseAsync(group,{binary:true});
 const path=new URL(`../host/models/${spec.name.toLowerCase()}.glb`,import.meta.url);
 await writeFile(path,Buffer.from(binary));console.log(`${spec.name}: ${binary.byteLength} bytes`);
}

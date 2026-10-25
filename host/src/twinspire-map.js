import {TWINSPIRE_LAYOUT,TWINSPIRE_SPAWNS} from '../../shared/twinspire-layout.js';
import {configureSolidTerrain} from './solid-terrain.js';

export function configureTwinspire(arena) {
  configureSolidTerrain(arena,TWINSPIRE_LAYOUT,TWINSPIRE_SPAWNS.map(p=>[...p]));
  arena.navigationBounds={x:0,z:0,hw:19.2,hd:10.2};
  arena.navigationFloorClearance=true;
}

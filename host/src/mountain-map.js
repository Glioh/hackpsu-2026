import {MOUNTAIN_LAYOUT} from '../../shared/mountain-layout.js';
import {configureSolidTerrain} from './solid-terrain.js';

export function configureMountain(arena) {
  configureSolidTerrain(arena,MOUNTAIN_LAYOUT,[[-4.5,6],[4.5,6]]);
}

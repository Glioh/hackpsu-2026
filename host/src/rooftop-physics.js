import {ROOFTOP_HULLS, ROOFTOP_BOUNDS} from './rooftop-hulls.js';
import {ROOFTOP_SCALE} from '../../shared/rooftop-config.js';
import {configureSolidTerrain} from './solid-terrain.js';

export function configureRooftop(arena) {
  const floor={name:'Roof',...ROOFTOP_BOUNDS,y:0,bottom:-.7,kind:'roof'};
  configureSolidTerrain(arena,[floor,...ROOFTOP_HULLS],
    [[-5.1,5.8],[3.6,5.8]].map(p=>p.map(v=>v*ROOFTOP_SCALE)));
}

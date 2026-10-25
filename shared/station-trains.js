// Shared by the concept and game. Simulation owns the clock and seeded RNG.
export const TRAIN_TRACKS=[-11.2,11.2];
export const TRAIN_HALF_LENGTH=14.85;
export const TRAIN_HALF_WIDTH=1.75;
export const TRAIN_DURATION=8;
export function createTrainSchedule(random=Math.random) {
  const schedules=TRAIN_TRACKS.map(()=>[4+random()*8]);
  return time=>schedules.map((schedule,i)=>{
    while(time>=schedule.at(-1)+TRAIN_DURATION)schedule.push(schedule.at(-1)+TRAIN_DURATION+5+random()*13);
    const pass=schedule.findIndex(start=>time<start+TRAIN_DURATION),arrival=schedule[pass];
    const elapsed=time-arrival,warning=elapsed>=-3&&elapsed<0,passing=elapsed>=0&&elapsed<TRAIN_DURATION;
    const direction=i===0?1:-1;
    return {pass,warning,passing,next:Math.ceil(Math.max(0,arrival-time)),
      x:direction*(-74+Math.max(0,Math.min(TRAIN_DURATION,elapsed))/TRAIN_DURATION*148),z:TRAIN_TRACKS[i],direction};
  });
}

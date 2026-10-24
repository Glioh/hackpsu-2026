import * as T from 'three';

export function createCharacter(color, mesh) {
  const group = new T.Group();
  const torso = new T.Group(); torso.position.y = .9; group.add(torso);
  const body = mesh(new T.CapsuleGeometry(.53,.65,6,12),color,torso); body.position.y = .25;
  const head = new T.Group(); head.position.y = .92; torso.add(head);
  const skull = mesh(new T.SphereGeometry(.44,20,16),color,head); skull.position.set(0,.18,.02);
  for (const x of [-.16,.16]) {
    const eye = mesh(new T.SphereGeometry(.11,12,8),'#fff8e7',head); eye.position.set(x,.24,.38);
    const pupil = mesh(new T.SphereGeometry(.055,10,8),'#242b28',head); pupil.position.set(x,.24,.47);
  }
  const arms = [-.78,.78].map(x => {
    const pivot = new T.Group(); pivot.position.set(x,.62,0); torso.add(pivot);
    const limb = mesh(new T.CapsuleGeometry(.19,.55,4,8),color,pivot); limb.position.y = -.3;
    const fist = mesh(new T.SphereGeometry(.28,12,12),color,pivot); fist.position.y = -.68;
    return pivot;
  });
  const legs = [-.29,.29].map(x => {
    const pivot = new T.Group(); pivot.position.set(x,.65,0); group.add(pivot);
    const limb = mesh(new T.CapsuleGeometry(.22,.4,4,8),'#333e35',pivot); limb.position.y = -.26;
    return pivot;
  });
  return { group, torso, head, arms, legs };
}

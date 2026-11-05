// npm run test:physics: the closed form must equal integrating
// F = −k(x−1) − c·v, a = F/m, for under-, critically- and over-damped springs,
// with and without initial velocity.

import { displacement, integrate, zetaOf } from "./spring.ts";

const cases = [
  { stiffness: 320, damping: 14, mass: 1, velocity: 0 },
  { stiffness: 260, damping: 18, mass: 1, velocity: 2 },
  { stiffness: 180, damping: 22, mass: 2.2, velocity: 0 },
  { stiffness: 100, damping: 20, mass: 1, velocity: -1 },
  { stiffness: 120, damping: 60, mass: 1, velocity: 0 },
];
let worst = 0;
for (const s of cases) {
  for (const t of [0.05, 0.13, 0.3, 0.7, 1.2]) {
    const err = Math.abs(displacement(s, t, -1.15, s.velocity) - integrate(s, t, -1.15, s.velocity, 1e-5));
    worst = Math.max(worst, err);
  }
  console.log(`  ✓ k ${s.stiffness} c ${s.damping} m ${s.mass} v ${s.velocity}  ζ ${zetaOf(s).toFixed(2)}`);
}
if (worst > 1e-3) {
  console.error(`closed form vs integration: max error ${worst}`);
  process.exit(1);
}
console.log(`Physics OK: closed form matches integration (max error ${worst.toExponential(1)}).`);

// The world: letters in a row, the orb, space, and the per-page sets. Owns the camera path and the orb path.
import * as THREE from 'three';
import { KeyPath } from '../engine/path.js';
import { CAP } from './letters.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildPaths(slots, extra = {}) {
  const [M, O, F, S] = slots;
  const add = (a, x, y, z) => a.clone().add(v(x, y, z));
  const cam = new KeyPath([
    // 0 · M · MIND: low three-quarter, the M towering on the right, empty space on the left for the copy
    { v: 0, pos: add(M, -7.5, -3.4, 23), target: add(M, -5.4, 0.6, 0), fov: 40, fovPortrait: 26, roll: 0.03 },
    // 0 -> 1: slide along the front of the row
    { v: 0.55, pos: add(M, 8, 0.2, 27), target: add(O, -5, 0, -3), fov: 40, fovPortrait: 26, roll: -0.02 },
    // 1 · O · OVER: the O on the right, the chart floating behind it
    { v: 1, pos: add(O, 5.5, 0.6, 25), target: add(O, -2.2, -0.4, -6), fov: 40, fovPortrait: 28, roll: 0.02 },
    // through the O
    { v: 1.34, pos: add(O, 0, 0.3, 3.5), target: add(O, 0, 0, -30), fov: 52, fovPortrait: 28, roll: 0.08 },
    { v: 1.55, pos: add(O, 2.5, 0.4, -13), target: add(F, 6, 1, -10), fov: 54, fovPortrait: 28, roll: 0.14 },
    // behind the F and around its right edge
    { v: 1.8, pos: add(F, 13.5, -1.2, -3), target: add(F, 1, 1.5, 6), fov: 48, fovPortrait: 28, roll: -0.08 },
    // 2 · F · FEAR: low heroic angle, candles pumping up toward the letter, copy on the right
    { v: 2, pos: add(F, 5.5, -4.6, 21), target: add(F, 4.2, 3.2, 0), fov: 44, fovPortrait: 28, roll: -0.045 },
    { v: 2.5, pos: add(F, 12, 1, 27), target: add(S, -3, 0, 0), fov: 40, fovPortrait: 28, roll: 0.02 },
    // 3 · O · OF: the orb in its slot, holders swarming around it
    { v: 3, pos: add(S, -6.5, 1.2, 28), target: add(S, -9.2, 0.2, 0), fov: 38, fovPortrait: 30, roll: 0 },
    // 4 · the pull-back: the whole word in a row, high in frame, the eclipse behind it
    { v: 4, pos: v(0, 2.2, 90), target: v(0, -5.2, 0), fov: 31, fovPortrait: 44, roll: 0 },
    // 5 · the tool: rise over the word and turn to the eclipse, so the scene is a calm backdrop for the page
    { v: 5, pos: v(-20, 30, 60), target: v(-85, 22, -420), fov: 42, roll: 0.02 },
  ]);
  const top = extra.pumpTop || add(F, -2.2, 4.4, 7.2);
  const orb = new KeyPath([
    { v: 0, pos: add(M, -6.2, -3.3, 10.5), target: v(0, 0, 0), fov: 1.3 },
    { v: 1, pos: add(O, 6.8, -3.4, 10.5), target: v(0, 0, 0), fov: 1.2 },
    { v: 1.34, pos: add(O, 0.9, -0.6, -4.5), target: v(0, 0, 0), fov: 1.1 },
    { v: 1.55, pos: add(O, 4.5, 0.6, -21), target: v(0, 0, 0), fov: 1.2 },
    { v: 1.8, pos: add(F, 9, 1.5, 3), target: v(0, 0, 0), fov: 1.35 },
    { v: 2, pos: top.clone().add(v(0, 1.9, 0)), target: v(0, 0, 0), fov: 1.45 },
    { v: 2.6, pos: add(S, 0, 0, 3), target: v(0, 0, 0), fov: 3.8 },
    { v: 3, pos: S.clone(), target: v(0, 0, 0), fov: CAP / 2 },
    { v: 4, pos: S.clone(), target: v(0, 0, 0), fov: CAP / 2 },
    { v: 5, pos: S.clone(), target: v(0, 0, 0), fov: CAP / 2 },
  ]);
  // Portrait: the same flight, but every page shot pulls back and frames its subject in the top half, above the copy
  const P = {
    0: { pos: add(M, -1, -2, 36), target: add(M, 0.5, -7.8, 0), fov: 58, roll: 0.02 },
    1: { pos: add(O, 0.5, -2, 31), target: add(O, 0, -7.4, -4), fov: 58, roll: 0 },
    2: { pos: add(F, 3, -3, 36), target: add(F, -1, -6.4, 0), fov: 58, roll: -0.03 },
    3: { pos: add(S, 0, -1.5, 35), target: add(S, 0, -7.8, 0), fov: 58, roll: 0 },
    4: { pos: v(0, 2, 122), target: v(0, -17.5, 0), fov: 58, roll: 0 },
    5: { pos: v(0, 30, 90), target: v(0, 46, -420), fov: 64, roll: 0 },
  };
  const camP = new KeyPath(cam.keys.map((k) => (Number.isInteger(k.v) ? Object.assign({ v: k.v }, P[k.v]) : Object.assign({}, k, { fov: k.fov + 14 }))));
  const OP = { 0: add(M, -2.6, -4.6, 11), 1: add(O, 3.2, -4.6, 9), 2: add(F, 4.2, 5.2, 6), 3: S.clone(), 4: S.clone(), 5: S.clone() };
  const orbP = new KeyPath(orb.keys.map((k) => (OP[k.v] ? Object.assign({}, k, { pos: OP[k.v] }) : k)));
  return { cam, orb, camP, orbP };
}

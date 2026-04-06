import type { Landmark } from '../types';

export const PINCH_ON = 0.05;
export const PINCH_OFF = 0.08;
export const GRAB_ON = 0.06;
export const GRAB_OFF = 0.08;

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export const distance3 = (a: Landmark, b: Landmark): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const centroid = (landmarks: Landmark[]): Landmark => {
  if (landmarks.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (let i = 0; i < landmarks.length; i += 1) {
    x += landmarks[i].x;
    y += landmarks[i].y;
    z += landmarks[i].z;
  }

  const inv = 1 / landmarks.length;
  return { x: x * inv, y: y * inv, z: z * inv };
};

export const isHandOpen = (landmarks: Landmark[]): boolean => {
  if (landmarks.length < 21) {
    return false;
  }

  const wrist = landmarks[0];
  const tips = [8, 12, 16, 20];
  let openCount = 0;

  for (let i = 0; i < tips.length; i += 1) {
    if (landmarks[tips[i]].y < wrist.y) {
      openCount += 1;
    }
  }

  return openCount >= 3;
};

export const emaLandmarks = (
  current: Landmark[],
  previous: Landmark[] | null,
  alpha = 0.45
): Landmark[] => {
  if (!previous || previous.length !== current.length) {
    return current;
  }

  const out = new Array<Landmark>(current.length);
  const inv = 1 - alpha;
  for (let i = 0; i < current.length; i += 1) {
    out[i] = {
      x: current[i].x * alpha + previous[i].x * inv,
      y: current[i].y * alpha + previous[i].y * inv,
      z: current[i].z * alpha + previous[i].z * inv,
    };
  }

  return out;
};

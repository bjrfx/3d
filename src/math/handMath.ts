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

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const sub = (a: Landmark, b: Landmark): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const length = (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

export const normalize = (v: Vec3): Vec3 => {
  const len = length(v);
  if (len <= 1e-6) {
    return { x: 0, y: 0, z: 0 };
  }
  const inv = 1 / len;
  return { x: v.x * inv, y: v.y * inv, z: v.z * inv };
};

export const palmNormal = (landmarks: Landmark[]): Vec3 | null => {
  if (landmarks.length < 18) {
    return null;
  }

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  const toIndex = sub(indexMcp, wrist);
  const toPinky = sub(pinkyMcp, wrist);
  return normalize(cross(toIndex, toPinky));
};

export const angleBetweenVec3 = (a: Vec3, b: Vec3): number => {
  const na = normalize(a);
  const nb = normalize(b);
  const cosine = clamp(dot(na, nb), -1, 1);
  return Math.acos(cosine);
};

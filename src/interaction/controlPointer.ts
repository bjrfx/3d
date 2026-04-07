import type { Landmark } from '../types';

const CONTROL_POINTER_GAIN = 1.7;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const mapControlPointerToScreen = (
  tip: Landmark,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } => {
  const baseX = 1 - tip.x;
  const baseY = tip.y;

  const amplifiedX = clamp01((baseX - 0.5) * CONTROL_POINTER_GAIN + 0.5);
  const amplifiedY = clamp01((baseY - 0.5) * CONTROL_POINTER_GAIN + 0.5);

  return {
    x: amplifiedX * viewportWidth,
    y: amplifiedY * viewportHeight,
  };
};

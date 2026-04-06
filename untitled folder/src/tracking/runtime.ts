import type { GestureState, HandData, HandPresence, Landmark } from '../types';

export interface TrackingRuntime {
  hands: HandPresence;
  gestures: { left: GestureState; right: GestureState };
  frameFps: number;
  updatedAt: number;
  videoSize: { width: number; height: number };
}

export const trackingRuntime: TrackingRuntime = {
  hands: {
    left: null,
    right: null,
  },
  gestures: {
    left: 'IDLE',
    right: 'IDLE',
  },
  frameFps: 0,
  updatedAt: 0,
  videoSize: { width: 640, height: 480 },
};

export const makeHandData = (
  landmarks: Landmark[],
  handedness: 'Left' | 'Right',
  confidence: number,
  centroid: Landmark,
  pinchDistance: number,
  grabDistance: number
): HandData => ({ landmarks, handedness, confidence, centroid, pinchDistance, grabDistance });

export type Handedness = 'Left' | 'Right';

export type GestureState = 'IDLE' | 'PINCH' | 'GRAB' | 'TRANSFORM' | 'RELEASE';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: Landmark[];
  handedness: Handedness;
  confidence: number;
  centroid: Landmark;
  pinchDistance: number;
  grabDistance: number;
}

export interface HandPresence {
  left: HandData | null;
  right: HandData | null;
}

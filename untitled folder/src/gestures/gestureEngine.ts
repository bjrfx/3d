import { isHandOpen } from '../math/handMath';
import type { GestureState, Landmark } from '../types';

interface InternalState {
  state: GestureState;
  openFrames: number;
}

const MIN_OPEN_FRAMES = 2;

export class GestureEngine {
  private left: InternalState = { state: 'IDLE', openFrames: 0 };

  private right: InternalState = { state: 'IDLE', openFrames: 0 };

  update(
    leftLandmarks: Landmark[] | null,
    rightLandmarks: Landmark[] | null,
    leftPinch: boolean,
    leftGrab: boolean,
    rightPinch: boolean,
    rightGrab: boolean,
    bothPresent: boolean
  ): { left: GestureState; right: GestureState } {
    this.left = this.advance(this.left, leftLandmarks, leftPinch, leftGrab, bothPresent);
    this.right = this.advance(this.right, rightLandmarks, rightPinch, rightGrab, bothPresent);

    if (bothPresent && this.left.state === 'PINCH' && this.right.state === 'PINCH') {
      this.left.state = 'TRANSFORM';
      this.right.state = 'TRANSFORM';
    }

    return { left: this.left.state, right: this.right.state };
  }

  private isActive(state: GestureState): boolean {
    return state === 'PINCH' || state === 'GRAB' || state === 'TRANSFORM';
  }

  private advance(
    current: InternalState,
    landmarks: Landmark[] | null,
    isPinching: boolean,
    isGrabbing: boolean,
    bothPresent: boolean
  ): InternalState {
    if (!landmarks) {
      return { state: 'IDLE', openFrames: 0 };
    }

    const next: InternalState = { ...current };
    const open = isHandOpen(landmarks);

    // GRAB has priority when both detectors fire simultaneously.
    if (isGrabbing) {
      next.state = 'GRAB';
      next.openFrames = 0;
      return next;
    }

    if (isPinching) {
      next.state = bothPresent && this.isActive(current.state) ? 'TRANSFORM' : 'PINCH';
      next.openFrames = 0;
      return next;
    }

    next.openFrames = open ? next.openFrames + 1 : 0;
    if (next.openFrames >= MIN_OPEN_FRAMES && current.state !== 'IDLE') {
      next.state = 'RELEASE';
      return next;
    }

    next.state = current.state === 'RELEASE' ? 'IDLE' : 'IDLE';
    return next;
  }
}

import { create } from 'zustand';
import type { GestureState } from '../types';

export type MoveMode = 'relative' | 'absolute';
export type InteractionMode = 'OBJECT_MODE' | 'CAMERA_MODE';

export type InteractionStateLabel = 'IDLE' | 'HOVER' | 'SELECT' | 'DRAG' | 'RELEASE';

interface InteractionState {
  fps: number;
  currentGesture: string;
  selectedObjectId: string | null;
  trackerStatus: 'loading' | 'ready' | 'error';
  showLandmarkOverlay: boolean;
  invertLeftPinch: boolean;
  moveMode: MoveMode;
  interactionMode: InteractionMode;
  interactionState: InteractionStateLabel;
  setFps: (fps: number) => void;
  setCurrentGesture: (gesture: string) => void;
  setSelectedObjectId: (id: string | null) => void;
  setTrackerStatus: (status: InteractionState['trackerStatus']) => void;
  toggleLandmarkOverlay: () => void;
  toggleInvertLeftPinch: () => void;
  setMoveMode: (mode: MoveMode) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setInteractionState: (state: InteractionStateLabel) => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  fps: 0,
  currentGesture: 'IDLE',
  selectedObjectId: null,
  trackerStatus: 'loading',
  showLandmarkOverlay: true,
  invertLeftPinch: false,
  moveMode: 'relative',
  interactionMode: 'CAMERA_MODE',
  interactionState: 'IDLE',
  setFps: (fps) => set({ fps }),
  setCurrentGesture: (gesture) => set({ currentGesture: gesture }),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  setTrackerStatus: (trackerStatus) => set({ trackerStatus }),
  toggleLandmarkOverlay: () => set((state) => ({ showLandmarkOverlay: !state.showLandmarkOverlay })),
  toggleInvertLeftPinch: () => set((state) => ({ invertLeftPinch: !state.invertLeftPinch })),
  setMoveMode: (moveMode) => set({ moveMode }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setInteractionState: (interactionState) => set({ interactionState }),
}));

export const useOverlayState = () => {
  const fps = useInteractionStore((s) => s.fps);
  const currentGesture = useInteractionStore((s) => s.currentGesture);
  const selectedObjectId = useInteractionStore((s) => s.selectedObjectId);
  const trackerStatus = useInteractionStore((s) => s.trackerStatus);
  const showLandmarkOverlay = useInteractionStore((s) => s.showLandmarkOverlay);
  const invertLeftPinch = useInteractionStore((s) => s.invertLeftPinch);
  const moveMode = useInteractionStore((s) => s.moveMode);
  const interactionMode = useInteractionStore((s) => s.interactionMode);
  const interactionState = useInteractionStore((s) => s.interactionState);
  const toggleLandmarkOverlay = useInteractionStore((s) => s.toggleLandmarkOverlay);
  const toggleInvertLeftPinch = useInteractionStore((s) => s.toggleInvertLeftPinch);
  const setMoveMode = useInteractionStore((s) => s.setMoveMode);

  return {
    fps,
    currentGesture,
    selectedObjectId,
    trackerStatus,
    showLandmarkOverlay,
    invertLeftPinch,
    moveMode,
    interactionMode,
    interactionState,
    toggleLandmarkOverlay,
    toggleInvertLeftPinch,
    setMoveMode,
  };
};

export const toGestureLabel = (left: GestureState, right: GestureState): string => {
  if (left === 'TRANSFORM' && right === 'TRANSFORM') {
    return 'TRANSFORM';
  }

  if (right !== 'IDLE') {
    return `RIGHT_${right}`;
  }

  if (left !== 'IDLE') {
    return `LEFT_${left}`;
  }

  return 'IDLE';
};

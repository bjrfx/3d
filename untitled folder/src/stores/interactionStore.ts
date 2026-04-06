import { create } from 'zustand';
import type { GestureState } from '../types';

export type MoveMode = 'relative' | 'absolute';
export type InteractionMode = 'OBJECT_MODE' | 'CAMERA_MODE';
export type ToolMode = 'SELECT' | 'DRAG' | 'TRANSFORM' | 'SCALE' | 'ROTATE' | 'MESHES';
export type MeshKind = 'sphere' | 'cube' | 'capsule' | 'circle' | 'cylinder' | 'torus';

export type InteractionStateLabel = 'IDLE' | 'HOVER' | 'SELECT' | 'DRAG' | 'RELEASE';

interface InteractionState {
  fps: number;
  currentGesture: string;
  selectedObjectId: string | null;
  trackerStatus: 'loading' | 'ready' | 'error';
  showLandmarkOverlay: boolean;
  moveMode: MoveMode;
  interactionMode: InteractionMode;
  interactionState: InteractionStateLabel;
  showDiagnostics: boolean;
  menuOpen: boolean;
  menuHoverActive: boolean;
  activeTool: ToolMode;
  selectedMeshKind: MeshKind;
  invertLeftPinch: boolean;
  lastAction: string;
  setFps: (fps: number) => void;
  setCurrentGesture: (gesture: string) => void;
  setSelectedObjectId: (id: string | null) => void;
  setTrackerStatus: (status: InteractionState['trackerStatus']) => void;
  toggleLandmarkOverlay: () => void;
  setMoveMode: (mode: MoveMode) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setInteractionState: (state: InteractionStateLabel) => void;
  toggleDiagnostics: () => void;
  setMenuOpen: (open: boolean) => void;
  setMenuHoverActive: (active: boolean) => void;
  setActiveTool: (tool: ToolMode) => void;
  setSelectedMeshKind: (mesh: MeshKind) => void;
  toggleInvertLeftPinch: () => void;
  setLastAction: (message: string) => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  fps: 0,
  currentGesture: 'IDLE',
  selectedObjectId: null,
  trackerStatus: 'loading',
  showLandmarkOverlay: true,
  moveMode: 'relative',
  interactionMode: 'CAMERA_MODE',
  interactionState: 'IDLE',
  showDiagnostics: true,
  menuOpen: true,
  menuHoverActive: false,
  activeTool: 'SELECT',
  selectedMeshKind: 'sphere',
  invertLeftPinch: false,
  lastAction: 'Ready',
  setFps: (fps) => set({ fps }),
  setCurrentGesture: (gesture) => set({ currentGesture: gesture }),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  setTrackerStatus: (trackerStatus) => set({ trackerStatus }),
  toggleLandmarkOverlay: () => set((state) => ({ showLandmarkOverlay: !state.showLandmarkOverlay })),
  setMoveMode: (moveMode) => set({ moveMode }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setInteractionState: (interactionState) => set({ interactionState }),
  toggleDiagnostics: () => set((state) => ({ showDiagnostics: !state.showDiagnostics })),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setMenuHoverActive: (menuHoverActive) => set({ menuHoverActive }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setSelectedMeshKind: (selectedMeshKind) => set({ selectedMeshKind }),
  toggleInvertLeftPinch: () => set((state) => ({ invertLeftPinch: !state.invertLeftPinch })),
  setLastAction: (lastAction) => set({ lastAction }),
}));

export const useOverlayState = () => {
  const fps = useInteractionStore((s) => s.fps);
  const currentGesture = useInteractionStore((s) => s.currentGesture);
  const selectedObjectId = useInteractionStore((s) => s.selectedObjectId);
  const trackerStatus = useInteractionStore((s) => s.trackerStatus);
  const showLandmarkOverlay = useInteractionStore((s) => s.showLandmarkOverlay);
  const moveMode = useInteractionStore((s) => s.moveMode);
  const interactionMode = useInteractionStore((s) => s.interactionMode);
  const interactionState = useInteractionStore((s) => s.interactionState);
  const showDiagnostics = useInteractionStore((s) => s.showDiagnostics);
  const menuOpen = useInteractionStore((s) => s.menuOpen);
  const activeTool = useInteractionStore((s) => s.activeTool);
  const selectedMeshKind = useInteractionStore((s) => s.selectedMeshKind);
  const invertLeftPinch = useInteractionStore((s) => s.invertLeftPinch);
  const lastAction = useInteractionStore((s) => s.lastAction);
  const toggleLandmarkOverlay = useInteractionStore((s) => s.toggleLandmarkOverlay);
  const setMoveMode = useInteractionStore((s) => s.setMoveMode);
  const toggleDiagnostics = useInteractionStore((s) => s.toggleDiagnostics);

  return {
    fps,
    currentGesture,
    selectedObjectId,
    trackerStatus,
    showLandmarkOverlay,
    moveMode,
    interactionMode,
    interactionState,
    showDiagnostics,
    menuOpen,
    activeTool,
    selectedMeshKind,
    invertLeftPinch,
    lastAction,
    toggleLandmarkOverlay,
    setMoveMode,
    toggleDiagnostics,
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

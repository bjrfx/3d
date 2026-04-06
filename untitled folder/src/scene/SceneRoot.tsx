import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import { Group, Intersection, MathUtils, Mesh, Object3D, Plane, Raycaster, Spherical, Vector3 } from 'three';
import {
  useInteractionStore,
  type InteractionStateLabel,
  type MeshKind,
  type ToolMode,
} from '../stores/interactionStore';
import { trackingRuntime } from '../tracking/runtime';
import { InteractiveObject } from './InteractiveObject';
import {
  applySmoothedDrag,
  beginGrab,
  computeDragTarget,
  createDragContext,
  endGrab,
  getRayDebugPoint,
  rayFromHand,
} from '../interaction/mapper';

const raycaster = new Raycaster();
const smoothTarget = new Vector3();
const rayDirectionPoint = new Vector3();
const frameDelta = new Vector3();
const grabStartHandWorld = new Vector3();
const cameraTarget = new Vector3();
const cameraForward = new Vector3();
const cameraNavHit = new Vector3();
const cameraNavDelta = new Vector3();
const cameraDesiredPosition = new Vector3();
const cameraDesiredTarget = new Vector3();
const orbitOffset = new Vector3();
const orbitSpherical = new Spherical();
const placementHit = new Vector3();
const placementPlane = new Plane(new Vector3(0, 1, 0), -1);
const scaleTarget = new Vector3();

const POSITION_LERP_ALPHA = 0.2;
const POSITION_DEADZONE = 0.002;
const MAX_EXTREME_JUMP = 1.2;
const PAN_SENSITIVITY = 1;
const PAN_LERP_ALPHA = 0.25;
const ZOOM_SENSITIVITY = 52;
const ZOOM_ORBIT_LERP_ALPHA = 0.22;
const ORBIT_SENSITIVITY_X = 4.8;
const ORBIT_SENSITIVITY_Y = 2.8;
const MIN_POLAR_ANGLE = 0.2;
const MAX_POLAR_ANGLE = Math.PI * 0.48;
const MIN_CAMERA_DISTANCE = 6;
const MAX_CAMERA_DISTANCE = 22;
const MESH_PLACE_COOLDOWN_MS = 240;
const SCALE_GAIN = 8;
const MIN_SCALE_FACTOR = 0.35;
const MAX_SCALE_FACTOR = 2.8;
const ROTATE_X_GAIN = 4.2;
const ROTATE_Y_GAIN = 6.4;
const ROTATE_LERP = 0.24;
const GIZMO_TRANSLATE_GAIN = 12;
const GIZMO_ROTATE_GAIN = 7;

type StageOneState = 'IDLE' | 'HOVER' | 'SELECT' | 'DRAG' | 'RELEASE';
type AxisName = 'X' | 'Y' | 'Z';

interface SceneObject {
  id: string;
  kind: MeshKind;
  position: [number, number, number];
}

interface TransformContext {
  active: boolean;
  objectId: string | null;
  axis: AxisName | null;
  startGrabDistance: number;
  startCentroidX: number;
  startCentroidY: number;
  startPosition: Vector3;
  startScale: Vector3;
  startRotation: Vector3;
}

const INITIAL_OBJECTS: SceneObject[] = [
  { id: 'cube-0', kind: 'cube', position: [-1.8, 1, 0] },
  { id: 'sphere-0', kind: 'sphere', position: [1.8, 1, 0] },
];

const SceneController = () => {
  const selectedObjectId = useInteractionStore((s) => s.selectedObjectId);
  const setSelectedObjectId = useInteractionStore((s) => s.setSelectedObjectId);
  const setInteractionMode = useInteractionStore((s) => s.setInteractionMode);
  const setInteractionState = useInteractionStore((s) => s.setInteractionState);
  const activeTool = useInteractionStore((s) => s.activeTool);
  const selectedMeshKind = useInteractionStore((s) => s.selectedMeshKind);
  const invertLeftPinch = useInteractionStore((s) => s.invertLeftPinch);
  const menuHoverActive = useInteractionStore((s) => s.menuHoverActive);
  const setLastAction = useInteractionStore((s) => s.setLastAction);

  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>(INITIAL_OBJECTS);

  const { camera, scene } = useThree();
  const controlsRef = useRef<any>(null);
  const cameraNavPlaneRef = useRef(new Plane());
  const cameraNavRef = useRef({
    panActive: false,
    zoomActive: false,
    panStartHand: new Vector3(),
    panStartCamera: new Vector3(),
    panStartTarget: new Vector3(),
    pinchStartX: 0,
    pinchStartY: 0,
    zoomStartPinch: 0,
    zoomStartDistance: 0,
    orbitStartTheta: 0,
    orbitStartPhi: 0,
    orbitTarget: new Vector3(),
  });
  const objectRefs = useRef<Record<string, Mesh>>({});
  const gizmoRootRef = useRef<Group>(null);
  const rayHitDebugRef = useRef<Mesh>(null);
  const dragRef = useRef(createDragContext());
  const stageStateRef = useRef<StageOneState>('IDLE');
  const hoverFramesRef = useRef(0);
  const prevPinchRef = useRef(false);
  const prevGrabRef = useRef(false);
  const lastUiStateRef = useRef<InteractionStateLabel>('IDLE');
  const lastModeRef = useRef<'OBJECT_MODE' | 'CAMERA_MODE'>('CAMERA_MODE');
  const transformRef = useRef<TransformContext>({
    active: false,
    objectId: null,
    axis: null,
    startGrabDistance: 0,
    startCentroidX: 0,
    startCentroidY: 0,
    startPosition: new Vector3(),
    startScale: new Vector3(1, 1, 1),
    startRotation: new Vector3(),
  });
  const gizmoAxisRef = useRef<AxisName | null>(null);
  const placeCooldownRef = useRef(0);
  const idCounterRef = useRef(2);

  const registerObject = (id: string, mesh: Mesh) => {
    objectRefs.current[id] = mesh;
  };

  const updateUiMode = (nextMode: 'OBJECT_MODE' | 'CAMERA_MODE') => {
    if (lastModeRef.current !== nextMode) {
      lastModeRef.current = nextMode;
      setInteractionMode(nextMode);
    }
  };

  const updateUiState = (next: StageOneState) => {
    if (lastUiStateRef.current !== next) {
      lastUiStateRef.current = next;
      setInteractionState(next);
    }
  };

  const setRayDebugPoint = (point: Vector3 | null) => {
    const debugMesh = rayHitDebugRef.current;
    if (!debugMesh) {
      return;
    }

    if (!point) {
      debugMesh.visible = false;
      return;
    }

    debugMesh.visible = true;
    debugMesh.position.copy(point);
  };

  const isSelectableHit = (object: Object3D): boolean => {
    let current: Object3D | null = object;
    while (current) {
      if (current.userData?.selectable) {
        return true;
      }
      current = current.parent;
    }
    return false;
  };

  const findSelectableIntersection = (hits: Intersection<Object3D>[]): Intersection<Object3D> | null => {
    for (let i = 0; i < hits.length; i += 1) {
      if (isSelectableHit(hits[i].object)) {
        return hits[i];
      }
    }
    return null;
  };

  const resolveTrackedObjectId = (object: Object3D): string | null => {
    let current: Object3D | null = object;
    while (current) {
      const found = Object.entries(objectRefs.current).find((entry) => entry[1] === current);
      if (found) {
        return found[0];
      }
      current = current.parent;
    }
    return null;
  };

  const findGizmoIntersection = (hits: Intersection<Object3D>[]) => {
    for (let i = 0; i < hits.length; i += 1) {
      const axis = hits[i].object.userData?.gizmoAxis as AxisName | undefined;
      if (axis) {
        return {
          axis,
          mode: (hits[i].object.userData?.gizmoMode as ToolMode | undefined) ?? null,
        };
      }
    }
    return { axis: null as AxisName | null, mode: null as ToolMode | null };
  };

  const raycastObjectFromHand = (rightHand: NonNullable<typeof trackingRuntime.hands.right>) => {
    const handRay = rayFromHand(camera, rightHand);
    raycaster.ray.copy(handRay);

    rayDirectionPoint.copy(getRayDebugPoint(5, rayDirectionPoint));
    setRayDebugPoint(rayDirectionPoint);

    const hits = raycaster.intersectObjects(scene.children, true);
    const gizmoHit = findGizmoIntersection(hits);
    const selectableHit = findSelectableIntersection(hits);

    if (!selectableHit) {
      return {
        id: null as string | null,
        mesh: null as Mesh | null,
        hitCount: hits.length,
        gizmoAxis: gizmoHit.axis,
        gizmoMode: gizmoHit.mode,
      };
    }

    const id = resolveTrackedObjectId(selectableHit.object);
    if (id) {
      return {
        id,
        mesh: objectRefs.current[id],
        hitCount: hits.length,
        gizmoAxis: gizmoHit.axis,
        gizmoMode: gizmoHit.mode,
      };
    }

    return {
      id: null as string | null,
      mesh: null as Mesh | null,
      hitCount: hits.length,
      gizmoAxis: gizmoHit.axis,
      gizmoMode: gizmoHit.mode,
    };
  };

  const placeMeshFromHand = (hand: NonNullable<typeof trackingRuntime.hands.right>, meshKind: MeshKind) => {
    const handRay = rayFromHand(camera, hand);
    if (!handRay.intersectPlane(placementPlane, placementHit)) {
      return;
    }

    const id = `${meshKind}-${idCounterRef.current}`;
    idCounterRef.current += 1;

    const next: SceneObject = {
      id,
      kind: meshKind,
      position: [placementHit.x, placementHit.y, placementHit.z],
    };

    setSceneObjects((current) => [...current, next]);
    setSelectedObjectId(id);
    setLastAction(`${meshKind} placed`);
  };

  const beginToolTransform = (tool: ToolMode, object: Mesh, right: NonNullable<typeof trackingRuntime.hands.right>) => {
    transformRef.current.active = true;
    transformRef.current.objectId = object.userData?.interactionId ?? null;
    transformRef.current.axis = gizmoAxisRef.current;
    transformRef.current.startGrabDistance = right.grabDistance;
    transformRef.current.startCentroidX = right.centroid.x;
    transformRef.current.startCentroidY = right.centroid.y;
    transformRef.current.startPosition.copy(object.position);
    transformRef.current.startScale.copy(object.scale);
    transformRef.current.startRotation.set(object.rotation.x, object.rotation.y, object.rotation.z);

    if (tool === 'SCALE') {
      setLastAction('Scale mode active');
    } else if (tool === 'ROTATE') {
      setLastAction('Rotate mode active');
    } else if (tool === 'TRANSFORM') {
      setLastAction(`Transform axis: ${transformRef.current.axis ?? 'Auto'}`);
    }
  };

  useFrame(() => {
    const now = performance.now();
    const left = trackingRuntime.hands.left;
    const right = trackingRuntime.hands.right;
    const leftState = trackingRuntime.gestures.left;
    const rightState = trackingRuntime.gestures.right;

    const leftNavGrab = Boolean(left && leftState === 'GRAB');
    const leftNavPinch = Boolean(left && leftState === 'PINCH');
    const rightPinchActive = rightState === 'PINCH' || rightState === 'TRANSFORM';
    const rightGrabActive = rightState === 'GRAB';
    const rightPinchStart = rightPinchActive && !prevPinchRef.current && !menuHoverActive;

    let activeSelectedId = selectedObjectId;
    let activeSelected = activeSelectedId ? objectRefs.current[activeSelectedId] : null;

    const controlsTarget = controlsRef.current?.target ?? cameraTarget.set(0, 0, 0);
    cameraTarget.copy(controlsTarget);

    if (left && leftNavGrab) {
      if (!cameraNavRef.current.panActive) {
        camera.getWorldDirection(cameraForward).normalize();
        cameraNavPlaneRef.current.setFromNormalAndCoplanarPoint(cameraForward, cameraTarget);

        const leftRay = rayFromHand(camera, left);
        if (leftRay.intersectPlane(cameraNavPlaneRef.current, cameraNavHit)) {
          cameraNavRef.current.panStartHand.copy(cameraNavHit);
          cameraNavRef.current.panStartCamera.copy(camera.position);
          cameraNavRef.current.panStartTarget.copy(cameraTarget);
          cameraNavRef.current.panActive = true;
        }
      } else {
        const leftRay = rayFromHand(camera, left);
        if (leftRay.intersectPlane(cameraNavPlaneRef.current, cameraNavHit)) {
          cameraNavDelta.copy(cameraNavHit).sub(cameraNavRef.current.panStartHand);
          cameraDesiredPosition
            .copy(cameraNavRef.current.panStartCamera)
            .addScaledVector(cameraNavDelta, -PAN_SENSITIVITY);
          cameraDesiredTarget
            .copy(cameraNavRef.current.panStartTarget)
            .addScaledVector(cameraNavDelta, -PAN_SENSITIVITY);

          camera.position.lerp(cameraDesiredPosition, PAN_LERP_ALPHA);
          controlsTarget.lerp(cameraDesiredTarget, PAN_LERP_ALPHA);
          controlsRef.current?.update();
        }
      }
    } else {
      cameraNavRef.current.panActive = false;
    }

    if (left && leftNavPinch) {
      if (!cameraNavRef.current.zoomActive) {
        cameraNavRef.current.zoomStartPinch = left.pinchDistance;
        cameraNavRef.current.zoomStartDistance = camera.position.distanceTo(cameraTarget);
        cameraNavRef.current.pinchStartX = left.centroid.x;
        cameraNavRef.current.pinchStartY = left.centroid.y;
        orbitOffset.copy(camera.position).sub(cameraTarget);
        orbitSpherical.setFromVector3(orbitOffset);
        cameraNavRef.current.orbitStartTheta = orbitSpherical.theta;
        cameraNavRef.current.orbitStartPhi = orbitSpherical.phi;
        cameraNavRef.current.orbitTarget.copy(cameraTarget);
        cameraNavRef.current.zoomActive = true;
      } else {
        const basePinchDelta = cameraNavRef.current.zoomStartPinch - left.pinchDistance;
        const pinchDelta = invertLeftPinch ? -basePinchDelta : basePinchDelta;
        const orbitDx = left.centroid.x - cameraNavRef.current.pinchStartX;
        const orbitDy = left.centroid.y - cameraNavRef.current.pinchStartY;
        const nextDistance = Math.min(
          MAX_CAMERA_DISTANCE,
          Math.max(MIN_CAMERA_DISTANCE, cameraNavRef.current.zoomStartDistance - pinchDelta * ZOOM_SENSITIVITY)
        );

        const nextTheta = cameraNavRef.current.orbitStartTheta - orbitDx * ORBIT_SENSITIVITY_X;
        const nextPhi = Math.min(
          MAX_POLAR_ANGLE,
          Math.max(MIN_POLAR_ANGLE, cameraNavRef.current.orbitStartPhi + orbitDy * ORBIT_SENSITIVITY_Y)
        );

        orbitSpherical.set(nextDistance, nextPhi, nextTheta);
        orbitOffset.setFromSpherical(orbitSpherical);

        cameraDesiredTarget.copy(cameraNavRef.current.orbitTarget);
        cameraDesiredPosition.copy(cameraDesiredTarget).add(orbitOffset);
        camera.position.lerp(cameraDesiredPosition, ZOOM_ORBIT_LERP_ALPHA);
        controlsTarget.lerp(cameraDesiredTarget, ZOOM_ORBIT_LERP_ALPHA);
        controlsRef.current?.update();
      }
    } else {
      cameraNavRef.current.zoomActive = false;
    }

    const cameraNavActive = cameraNavRef.current.panActive || cameraNavRef.current.zoomActive;
    if (controlsRef.current) {
      controlsRef.current.enabled = !cameraNavActive;
    }

    const hoverHit = right
      ? raycastObjectFromHand(right)
      : { id: null as string | null, mesh: null as Mesh | null, hitCount: 0, gizmoAxis: null, gizmoMode: null };
    if (!right || activeTool === 'MESHES') {
      setRayDebugPoint(null);
    }

    if (hoverHit.id) {
      hoverFramesRef.current += 1;
    } else {
      hoverFramesRef.current = 0;
    }

    if (rightPinchStart && right) {
      if (hoverHit.gizmoAxis && activeTool !== 'MESHES' && activeSelectedId) {
        const gizmoAllowed =
          activeTool === 'TRANSFORM' || activeTool === 'SCALE' || activeTool === 'ROTATE';
        if (gizmoAllowed) {
          gizmoAxisRef.current = hoverHit.gizmoAxis;
          setLastAction(`${activeTool} axis: ${hoverHit.gizmoAxis}`);
          stageStateRef.current = 'SELECT';
        }
      } else if (activeTool === 'MESHES') {
        if (now - placeCooldownRef.current >= MESH_PLACE_COOLDOWN_MS) {
          placeCooldownRef.current = now;
          placeMeshFromHand(right, selectedMeshKind);
          stageStateRef.current = 'SELECT';
        }
      } else {
        if (hoverHit.id) {
          if (activeSelectedId !== hoverHit.id) {
            setSelectedObjectId(hoverHit.id);
            activeSelectedId = hoverHit.id;
            activeSelected = objectRefs.current[hoverHit.id];
          }
          gizmoAxisRef.current = null;
          stageStateRef.current = 'SELECT';
          setLastAction(`Selected ${hoverHit.id}`);
        } else {
          if (activeSelectedId) {
            setSelectedObjectId(null);
            activeSelectedId = null;
            activeSelected = null;
          }
          gizmoAxisRef.current = null;
          stageStateRef.current = 'HOVER';
        }
      }
    }

    const canManipulateObject =
      activeTool !== 'MESHES' && activeTool !== 'SELECT' && Boolean(activeSelected) && Boolean(right) && !menuHoverActive;
    const grabStart = rightGrabActive && !prevGrabRef.current && !menuHoverActive;

    if (grabStart && canManipulateObject && right && activeSelected) {
      if (activeTool === 'DRAG') {
        beginGrab(camera, right, activeSelected, dragRef.current, grabStartHandWorld);
      } else {
        beginToolTransform(activeTool, activeSelected, right);
      }
      stageStateRef.current = 'DRAG';
    }

    if (rightGrabActive && canManipulateObject && right && activeSelected) {
      if (activeTool === 'DRAG') {
        if (!dragRef.current.active || dragRef.current.object !== activeSelected) {
          beginGrab(camera, right, activeSelected, dragRef.current, grabStartHandWorld);
        }

        if (computeDragTarget(camera, right, dragRef.current, smoothTarget)) {
          applySmoothedDrag(
            dragRef.current.object!,
            smoothTarget,
            frameDelta,
            POSITION_DEADZONE,
            MAX_EXTREME_JUMP,
            POSITION_LERP_ALPHA
          );
        }
      }

      if (activeTool === 'SCALE') {
        if (!transformRef.current.active || transformRef.current.objectId !== activeSelected.userData?.interactionId) {
          beginToolTransform(activeTool, activeSelected, right);
        }
        const axis = transformRef.current.axis;
        const scaleDelta = right.grabDistance - transformRef.current.startGrabDistance;
        const factor = MathUtils.clamp(1 + scaleDelta * SCALE_GAIN, MIN_SCALE_FACTOR, MAX_SCALE_FACTOR);
        scaleTarget.copy(transformRef.current.startScale);
        if (!axis) {
          scaleTarget.multiplyScalar(factor);
        } else if (axis === 'X') {
          scaleTarget.x = MathUtils.clamp(transformRef.current.startScale.x * factor, 0.12, 8);
        } else if (axis === 'Y') {
          scaleTarget.y = MathUtils.clamp(transformRef.current.startScale.y * factor, 0.12, 8);
        } else if (axis === 'Z') {
          scaleTarget.z = MathUtils.clamp(transformRef.current.startScale.z * factor, 0.12, 8);
        }
        activeSelected.scale.lerp(scaleTarget, 0.22);
      }

      if (activeTool === 'ROTATE') {
        if (!transformRef.current.active || transformRef.current.objectId !== activeSelected.userData?.interactionId) {
          beginToolTransform(activeTool, activeSelected, right);
        }

        const dx = right.centroid.x - transformRef.current.startCentroidX;
        const dy = right.centroid.y - transformRef.current.startCentroidY;
        const axis = transformRef.current.axis;
        const spin = (dx - dy) * GIZMO_ROTATE_GAIN;

        if (!axis || axis === 'X') {
          const targetRotX = transformRef.current.startRotation.x + dy * ROTATE_X_GAIN;
          activeSelected.rotation.x = MathUtils.lerp(activeSelected.rotation.x, targetRotX, ROTATE_LERP);
        }
        if (!axis || axis === 'Y') {
          const targetRotY = transformRef.current.startRotation.y - dx * ROTATE_Y_GAIN;
          activeSelected.rotation.y = MathUtils.lerp(activeSelected.rotation.y, targetRotY, ROTATE_LERP);
        }
        if (axis === 'Z') {
          const targetRotZ = transformRef.current.startRotation.z + spin;
          activeSelected.rotation.z = MathUtils.lerp(activeSelected.rotation.z, targetRotZ, ROTATE_LERP);
        }
      }

      if (activeTool === 'TRANSFORM') {
        if (!transformRef.current.active || transformRef.current.objectId !== activeSelected.userData?.interactionId) {
          beginToolTransform(activeTool, activeSelected, right);
        }

        const axis = transformRef.current.axis;
        const dx = right.centroid.x - transformRef.current.startCentroidX;
        const dy = right.centroid.y - transformRef.current.startCentroidY;
        const amount = (dx - dy) * GIZMO_TRANSLATE_GAIN;

        smoothTarget.copy(transformRef.current.startPosition);
        if (!axis || axis === 'X') {
          smoothTarget.x = transformRef.current.startPosition.x + amount;
        }
        if (!axis || axis === 'Y') {
          smoothTarget.y = transformRef.current.startPosition.y + amount;
        }
        if (!axis || axis === 'Z') {
          smoothTarget.z = transformRef.current.startPosition.z + amount;
        }
        applySmoothedDrag(
          activeSelected,
          smoothTarget,
          frameDelta,
          POSITION_DEADZONE,
          MAX_EXTREME_JUMP,
          0.3
        );
      }

      stageStateRef.current = 'DRAG';
    }

    const grabRelease = !rightGrabActive && prevGrabRef.current;
    if (grabRelease) {
      endGrab(dragRef.current);
      transformRef.current.active = false;
      transformRef.current.objectId = null;
      transformRef.current.axis = null;
      stageStateRef.current = 'RELEASE';
    }

    if (!right && stageStateRef.current !== 'IDLE') {
      stageStateRef.current = 'IDLE';
      endGrab(dragRef.current);
      transformRef.current.active = false;
      transformRef.current.objectId = null;
      transformRef.current.axis = null;
      gizmoAxisRef.current = null;
    }

    if (stageStateRef.current === 'RELEASE') {
      stageStateRef.current = right ? 'HOVER' : 'IDLE';
    }

    if (stageStateRef.current === 'IDLE' && hoverFramesRef.current >= 2 && right) {
      stageStateRef.current = 'HOVER';
    }

    const objectModeActive = rightGrabActive || (rightPinchActive && activeTool !== 'MESHES') || Boolean(activeSelectedId);
    if (objectModeActive) {
      updateUiMode('OBJECT_MODE');
    } else {
      updateUiMode('CAMERA_MODE');
    }

    if (gizmoRootRef.current) {
      const selectedMesh = activeSelectedId ? objectRefs.current[activeSelectedId] : null;
      if (selectedMesh && (activeTool === 'TRANSFORM' || activeTool === 'SCALE' || activeTool === 'ROTATE')) {
        gizmoRootRef.current.visible = true;
        gizmoRootRef.current.position.copy(selectedMesh.position);
      } else {
        gizmoRootRef.current.visible = false;
      }
    }

    updateUiState(stageStateRef.current);

    prevPinchRef.current = rightPinchActive;
    prevGrabRef.current = rightGrabActive;
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 9, 5]} intensity={1.4} castShadow />
      <axesHelper args={[5]} />
      <gridHelper args={[20, 20, '#5b6d8e', '#2f3b4e']} position={[0, 0.001, 0]} />
      <Text position={[5.5, 0.18, 0]} fontSize={0.24} color="#ff4d4d" anchorX="center" anchorY="middle">
        X
      </Text>
      <Text position={[0, 5.5, 0]} fontSize={0.24} color="#5cf05c" anchorX="center" anchorY="middle">
        Y
      </Text>
      <Text position={[0, 0.18, 5.5]} fontSize={0.24} color="#4fa5ff" anchorX="center" anchorY="middle">
        Z
      </Text>

      {sceneObjects.map((item) => (
        <InteractiveObject
          key={item.id}
          id={item.id}
          kind={item.kind}
          position={item.position}
          selected={selectedObjectId === item.id}
          onReady={registerObject}
        />
      ))}

      <group ref={gizmoRootRef} visible={false}>
        {activeTool === 'TRANSFORM' && (
          <>
            <mesh position={[1.45, 0, 0]} userData={{ gizmoAxis: 'X', gizmoMode: 'TRANSFORM' }}>
              <boxGeometry args={[1.2, 0.06, 0.06]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'X' ? '#ffb1b1' : '#ff4d4d'} />
            </mesh>
            <mesh position={[0, 1.45, 0]} userData={{ gizmoAxis: 'Y', gizmoMode: 'TRANSFORM' }}>
              <boxGeometry args={[0.06, 1.2, 0.06]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'Y' ? '#baffc9' : '#52e052'} />
            </mesh>
            <mesh position={[0, 0, 1.45]} userData={{ gizmoAxis: 'Z', gizmoMode: 'TRANSFORM' }}>
              <boxGeometry args={[0.06, 0.06, 1.2]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'Z' ? '#bad8ff' : '#4fa5ff'} />
            </mesh>
          </>
        )}

        {activeTool === 'SCALE' && (
          <>
            <mesh position={[1.4, 0, 0]} userData={{ gizmoAxis: 'X', gizmoMode: 'SCALE' }}>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'X' ? '#ffb1b1' : '#ff4d4d'} />
            </mesh>
            <mesh position={[0, 1.4, 0]} userData={{ gizmoAxis: 'Y', gizmoMode: 'SCALE' }}>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'Y' ? '#baffc9' : '#52e052'} />
            </mesh>
            <mesh position={[0, 0, 1.4]} userData={{ gizmoAxis: 'Z', gizmoMode: 'SCALE' }}>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'Z' ? '#bad8ff' : '#4fa5ff'} />
            </mesh>
          </>
        )}

        {activeTool === 'ROTATE' && (
          <>
            <mesh rotation={[0, Math.PI / 2, 0]} userData={{ gizmoAxis: 'X', gizmoMode: 'ROTATE' }}>
              <torusGeometry args={[1.2, 0.02, 10, 80]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'X' ? '#ffb1b1' : '#ff4d4d'} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ gizmoAxis: 'Y', gizmoMode: 'ROTATE' }}>
              <torusGeometry args={[1.22, 0.02, 10, 80]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'Y' ? '#baffc9' : '#52e052'} />
            </mesh>
            <mesh userData={{ gizmoAxis: 'Z', gizmoMode: 'ROTATE' }}>
              <torusGeometry args={[1.24, 0.02, 10, 80]} />
              <meshBasicMaterial color={gizmoAxisRef.current === 'Z' ? '#bad8ff' : '#4fa5ff'} />
            </mesh>
          </>
        )}
      </group>

      <mesh ref={rayHitDebugRef} visible={false}>
        <sphereGeometry args={[0.06]} />
        <meshBasicMaterial color="#ff2d55" />
      </mesh>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        maxPolarAngle={MAX_POLAR_ANGLE}
        minDistance={MIN_CAMERA_DISTANCE}
        maxDistance={MAX_CAMERA_DISTANCE}
      />
    </>
  );
};

export const SceneRoot = () => {
  const cameraPosition = useMemo<[number, number, number]>(() => [0, 5.4, 11], []);

  return (
    <Canvas camera={{ position: cameraPosition, fov: 48 }} shadows gl={{ antialias: true }}>
      <color attach="background" args={['#0b1018']} />
      <fog attach="fog" args={['#0b1018', 12, 36]} />
      <SceneController />
    </Canvas>
  );
};

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { Intersection, Mesh, Object3D, Plane, Raycaster, Spherical, Vector3 } from 'three';
import { useInteractionStore, type InteractionStateLabel } from '../stores/interactionStore';
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
const RIGHT_SELECTOR_SENSITIVITY = 2.20;

type StageOneState = 'IDLE' | 'HOVER' | 'SELECT' | 'DRAG' | 'RELEASE';

const SceneController = () => {
  const selectedObjectId = useInteractionStore((s) => s.selectedObjectId);
  const setSelectedObjectId = useInteractionStore((s) => s.setSelectedObjectId);
  const setInteractionMode = useInteractionStore((s) => s.setInteractionMode);
  const setInteractionState = useInteractionStore((s) => s.setInteractionState);

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
  const rayHitDebugRef = useRef<Mesh>(null);
  const dragRef = useRef(createDragContext());
  const stageStateRef = useRef<StageOneState>('IDLE');
  const hoverFramesRef = useRef(0);
  const prevPinchRef = useRef(false);
  const prevGrabRef = useRef(false);
  const lastUiStateRef = useRef<InteractionStateLabel>('IDLE');
  const lastModeRef = useRef<'OBJECT_MODE' | 'CAMERA_MODE'>('CAMERA_MODE');
  const lastDebugKeyRef = useRef('');

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

  const raycastObjectFromHand = (rightHand: NonNullable<typeof trackingRuntime.hands.right>) => {
    const handRay = rayFromHand(camera, rightHand, RIGHT_SELECTOR_SENSITIVITY);
    raycaster.ray.copy(handRay);

    rayDirectionPoint.copy(getRayDebugPoint(5, rayDirectionPoint));
    setRayDebugPoint(rayDirectionPoint);

    const hits = raycaster.intersectObjects(scene.children, true);
    const selectableHit = findSelectableIntersection(hits);

    const indexTip = rightHand.landmarks[8] ?? rightHand.centroid;
    const ndcX = -(indexTip.x * 2 - 1);
    const ndcY = -(indexTip.y * 2 - 1);

    console.log({
      ndcX,
      ndcY,
      intersects: hits.length,
    });

    if (!selectableHit) {
      return { id: null as string | null, mesh: null as Mesh | null, hitCount: 0 };
    }

    const id = resolveTrackedObjectId(selectableHit.object);
    if (id) {
      return { id, mesh: objectRefs.current[id], hitCount: hits.length };
    }

    return { id: null as string | null, mesh: null as Mesh | null, hitCount: hits.length };
  };

  useFrame(() => {
    const left = trackingRuntime.hands.left;
    const right = trackingRuntime.hands.right;
    const leftState = trackingRuntime.gestures.left;
    const rightState = trackingRuntime.gestures.right;
    const pinchActive = rightState === 'PINCH' || rightState === 'TRANSFORM';
    const grabActive = rightState === 'GRAB';
    const leftActive = leftState === 'PINCH' || leftState === 'GRAB' || leftState === 'TRANSFORM';
    const leftNavGrab = Boolean(left && leftState === 'GRAB');
    const leftNavPinch = Boolean(left && (leftState === 'PINCH' || leftState === 'TRANSFORM'));
    const noHandsActive = !pinchActive && !grabActive && !leftActive;

    let activeSelectedId = selectedObjectId;
    let activeSelected = activeSelectedId ? objectRefs.current[activeSelectedId] : null;

    const cameraNavActive = leftNavGrab || leftNavPinch;

    if (!activeSelected && (noHandsActive || cameraNavActive)) {
      updateUiMode('CAMERA_MODE');
    } else {
      updateUiMode('OBJECT_MODE');
    }

    if (controlsRef.current) {
      controlsRef.current.enabled = !cameraNavActive;
    }

    if (left && cameraNavActive) {
      const controlsTarget = controlsRef.current?.target ?? cameraTarget.set(0, 0, 0);
      cameraTarget.copy(controlsTarget);

      if (leftNavGrab) {
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

      if (leftNavPinch) {
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
          const pinchDelta = cameraNavRef.current.zoomStartPinch - left.pinchDistance;
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

    } else {
      cameraNavRef.current.panActive = false;
      cameraNavRef.current.zoomActive = false;
    }

    const hoverHit = right ? raycastObjectFromHand(right) : { id: null, mesh: null, hitCount: 0 };
    if (hoverHit.id) {
      hoverFramesRef.current += 1;
    } else {
      hoverFramesRef.current = 0;
    }

    if (!right && stageStateRef.current !== 'RELEASE') {
      if (prevPinchRef.current) {
        stageStateRef.current = 'RELEASE';
      } else {
        stageStateRef.current = 'IDLE';
      }
      endGrab(dragRef.current);
      updateUiState(stageStateRef.current);
      const debugKey = `${pinchActive}|${grabActive}|${activeSelectedId ?? 'None'}|${stageStateRef.current}|${lastModeRef.current}`;
      if (debugKey !== lastDebugKeyRef.current) {
        lastDebugKeyRef.current = debugKey;
        console.log({
          pinch: pinchActive,
          grab: grabActive,
          selected: activeSelectedId,
          state: stageStateRef.current,
          mode: lastModeRef.current,
        });
      }
      prevPinchRef.current = pinchActive;
      prevGrabRef.current = grabActive;
      return;
    }

    if (stageStateRef.current === 'IDLE' && hoverFramesRef.current >= 2) {
      stageStateRef.current = 'HOVER';
    }

    if (!dragRef.current.active && pinchActive && right) {
      const selectedHit = hoverHit.id ? hoverHit : raycastObjectFromHand(right);
      console.log({
        pinch: pinchActive,
        rayHits: selectedHit.hitCount,
      });
      if (selectedHit.id) {
        if (activeSelectedId !== selectedHit.id) {
          setSelectedObjectId(selectedHit.id);
          activeSelectedId = selectedHit.id;
          activeSelected = objectRefs.current[selectedHit.id];
        }
        stageStateRef.current = 'SELECT';
        updateUiMode('OBJECT_MODE');
      } else {
        if (activeSelectedId) {
          setSelectedObjectId(null);
          activeSelectedId = null;
          activeSelected = null;
        }
        if (stageStateRef.current !== 'DRAG') {
          stageStateRef.current = 'HOVER';
        }
      }
    }

    if (!pinchActive && prevPinchRef.current && stageStateRef.current !== 'DRAG') {
      stageStateRef.current = 'RELEASE';
    }

    const grabStart = grabActive && !prevGrabRef.current;
    if (grabStart && activeSelected && right) {
      beginGrab(camera, right, activeSelected, dragRef.current, grabStartHandWorld);
      stageStateRef.current = 'DRAG';
      updateUiMode('OBJECT_MODE');
    }

    if (grabActive && activeSelected && right) {
      if (!dragRef.current.active || dragRef.current.object !== activeSelected) {
        beginGrab(camera, right, activeSelected, dragRef.current, grabStartHandWorld);
      }
      stageStateRef.current = 'DRAG';
    }

    if (stageStateRef.current === 'DRAG' && right && grabActive && dragRef.current.active && dragRef.current.object) {
      if (computeDragTarget(camera, right, dragRef.current, smoothTarget)) {
        applySmoothedDrag(
          dragRef.current.object,
          smoothTarget,
          frameDelta,
          POSITION_DEADZONE,
          MAX_EXTREME_JUMP,
          POSITION_LERP_ALPHA
        );
      }
    }

    const grabRelease = !grabActive && prevGrabRef.current;
    if (grabRelease) {
      stageStateRef.current = 'RELEASE';
      endGrab(dragRef.current);
    }

    if (stageStateRef.current === 'DRAG' && (!right || rightState === 'RELEASE' || rightState === 'IDLE')) {
      stageStateRef.current = 'RELEASE';
      endGrab(dragRef.current);
    }

    if (stageStateRef.current === 'RELEASE') {
      stageStateRef.current = right ? 'HOVER' : 'IDLE';
      endGrab(dragRef.current);
    }

    if (!pinchActive) {
      setRayDebugPoint(null);
    }

    updateUiState(stageStateRef.current);

    const debugKey = `${pinchActive}|${grabActive}|${activeSelectedId ?? 'None'}|${stageStateRef.current}|${lastModeRef.current}`;
    if (debugKey !== lastDebugKeyRef.current) {
      lastDebugKeyRef.current = debugKey;
      console.log({
        pinch: pinchActive,
        grab: grabActive,
        selected: activeSelectedId,
        state: stageStateRef.current,
        mode: lastModeRef.current,
      });
    }

    prevPinchRef.current = pinchActive;
    prevGrabRef.current = grabActive;
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
      <InteractiveObject
        id="cube"
        kind="cube"
        position={[-1.8, 1, 0]}
        selected={selectedObjectId === 'cube'}
        onReady={registerObject}
      />
      <InteractiveObject
        id="sphere"
        kind="sphere"
        position={[1.8, 1, 0]}
        selected={selectedObjectId === 'sphere'}
        onReady={registerObject}
      />
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

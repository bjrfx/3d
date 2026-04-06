import { MathUtils, Plane, Ray, Vector2, Vector3 } from 'three';
import type { Camera, Mesh } from 'three';
import type { HandData } from '../types';

const ndc = new Vector2();
const direction = new Vector3();
const cameraRight = new Vector3();
const cameraUp = new Vector3();
const cameraForward = new Vector3();
const origin = new Vector3();
const ray = new Ray();
const planeAnchor = new Vector3();
const worldDelta = new Vector3();

const DEPTH_SENSITIVITY = 15;

export interface DragContext {
  active: boolean;
  object: Mesh | null;
  plane: Plane;
  grabDepth: number;
  initialHandZ: number;
  initialObjectZ: number;
  cameraRight: Vector3;
  cameraUp: Vector3;
  cameraForward: Vector3;
  grabOffset: Vector3;
  grabStartHand: Vector3;
  grabStartObject: Vector3;
  handWorld: Vector3;
  targetPoint: Vector3;
}

export const createDragContext = (): DragContext => ({
  active: false,
  object: null,
  plane: new Plane(),
  grabDepth: 0,
  initialHandZ: 0,
  initialObjectZ: 0,
  cameraRight: new Vector3(1, 0, 0),
  cameraUp: new Vector3(0, 1, 0),
  cameraForward: new Vector3(0, 0, -1),
  grabOffset: new Vector3(),
  grabStartHand: new Vector3(),
  grabStartObject: new Vector3(),
  handWorld: new Vector3(),
  targetPoint: new Vector3(),
});

export const handToNdc = (hand: HandData, out = ndc): Vector2 => {
  const tip = hand.landmarks[8] ?? hand.centroid;
  out.set(-(tip.x * 2 - 1), -(tip.y * 2 - 1));
  return out;
};

export const rayFromHand = (camera: Camera, hand: HandData): Ray => {
  const coords = handToNdc(hand);
  origin.setFromMatrixPosition(camera.matrixWorld);
  direction.set(coords.x, coords.y, 0.5).unproject(camera).sub(origin).normalize();
  ray.set(origin, direction);
  return ray;
};

export const setDepthPlane = (camera: Camera, depth: number, outPlane: Plane): void => {
  camera.getWorldDirection(direction).normalize();
  origin.setFromMatrixPosition(camera.matrixWorld);
  planeAnchor.copy(origin).addScaledVector(direction, depth);
  outPlane.setFromNormalAndCoplanarPoint(direction, planeAnchor);
};

export const getHandWorldPosition = (
  camera: Camera,
  hand: HandData,
  plane: Plane,
  out: Vector3
): boolean => {
  const handRay = rayFromHand(camera, hand);
  return handRay.intersectPlane(plane, out) !== null;
};

export const getHandCentroidWorldPosition = (
  camera: Camera,
  hand: HandData,
  plane: Plane,
  out: Vector3
): boolean => {
  ndc.set(-(hand.centroid.x * 2 - 1), -(hand.centroid.y * 2 - 1));
  origin.setFromMatrixPosition(camera.matrixWorld);
  direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(origin).normalize();
  ray.set(origin, direction);
  return ray.intersectPlane(plane, out) !== null;
};

export const beginGrab = (
  camera: Camera,
  hand: HandData,
  object: Mesh,
  drag: DragContext,
  outHand: Vector3
): void => {
  cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  cameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  camera.getWorldDirection(cameraForward).normalize();

  origin.setFromMatrixPosition(camera.matrixWorld);
  drag.grabDepth = planeAnchor.copy(object.position).sub(origin).dot(cameraForward);
  setDepthPlane(camera, drag.grabDepth, drag.plane);

  if (!getHandCentroidWorldPosition(camera, hand, drag.plane, outHand)) {
    outHand.copy(object.position);
  }

  drag.active = true;
  drag.object = object;
  drag.grabStartHand.copy(outHand);
  drag.grabStartObject.copy(object.position);
  drag.grabOffset.copy(object.position).sub(outHand);
  drag.initialHandZ = hand.centroid.z;
  drag.initialObjectZ = object.position.z;
  drag.cameraRight.copy(cameraRight);
  drag.cameraUp.copy(cameraUp);
  drag.cameraForward.copy(cameraForward);
  drag.targetPoint.copy(object.position);
};

export const computeDragTarget = (
  camera: Camera,
  hand: HandData,
  drag: DragContext,
  outTarget: Vector3
): boolean => {
  setDepthPlane(camera, drag.grabDepth, drag.plane);
  if (!getHandCentroidWorldPosition(camera, hand, drag.plane, drag.handWorld)) {
    return false;
  }

  worldDelta.copy(drag.handWorld).sub(drag.grabStartHand);
  const deltaRight = worldDelta.dot(drag.cameraRight);
  const deltaUp = worldDelta.dot(drag.cameraUp);
  const depthDelta = drag.initialHandZ - hand.centroid.z;
  const depthOffset = depthDelta * DEPTH_SENSITIVITY;

  outTarget.copy(drag.grabStartObject);
  outTarget.addScaledVector(drag.cameraRight, deltaRight);
  outTarget.addScaledVector(drag.cameraUp, deltaUp);
  outTarget.addScaledVector(drag.cameraForward, depthOffset);

  console.log({
    deltaRight,
    deltaUp,
    depthDelta,
    depthOffset,
    target: { x: outTarget.x, y: outTarget.y, z: outTarget.z },
  });

  drag.targetPoint.copy(outTarget);
  return true;
};

export const endGrab = (drag: DragContext): void => {
  drag.active = false;
  drag.object = null;
};

export const resetDragTarget = (drag: DragContext): void => {
  if (drag.object) {
    drag.targetPoint.copy(drag.object.position);
  }
};

export const applySmoothedDrag = (
  object: Mesh,
  target: Vector3,
  delta: Vector3,
  deadZone: number,
  maxExtremeJump: number,
  baseLerp: number
): void => {
  delta.copy(target).sub(object.position);
  const distance = delta.length();
  if (distance < deadZone) {
    return;
  }

  if (distance > maxExtremeJump) {
    delta.multiplyScalar(maxExtremeJump / distance);
  }

  const dynamicLerp = MathUtils.clamp(0.2 + distance * 2.0, 0.2, 0.6);
  const lerpAlpha = Math.max(baseLerp, dynamicLerp);
  object.position.add(delta.multiplyScalar(lerpAlpha));
};

export const getRayDebugPoint = (distance = 5, out = planeAnchor): Vector3 => {
  out.copy(ray.origin).addScaledVector(ray.direction, distance);
  return out;
};

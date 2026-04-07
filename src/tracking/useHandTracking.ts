import { useEffect, useRef } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureEngine } from '../gestures/gestureEngine';
import {
  centroid,
  distance3,
  emaLandmarks,
  GRAB_OFF,
  GRAB_ON,
  PINCH_OFF,
  PINCH_ON,
  RING_PINCH_OFF,
  RING_PINCH_ON,
} from '../math/handMath';
import { useInteractionStore, toGestureLabel } from '../stores/interactionStore';
import { makeHandData, trackingRuntime } from './runtime';
import type { HandData, Landmark } from '../types';

interface Candidate {
  landmarks: Landmark[];
  label: 'Left' | 'Right';
  confidence: number;
  centroid: Landmark;
  pinchDistance: number;
  grabDistance: number;
  ringPinchDistance: number;
}

const TRACK_INTERVAL_MS = 33;

export const useHandTracking = (canvasRef: { current: HTMLCanvasElement | null }) => {
  const setFps = useInteractionStore((s) => s.setFps);
  const setCurrentGesture = useInteractionStore((s) => s.setCurrentGesture);
  const setTrackerStatus = useInteractionStore((s) => s.setTrackerStatus);
  const showOverlay = useInteractionStore((s) => s.showLandmarkOverlay);
  const toggleRightPointerMode = useInteractionStore((s) => s.toggleRightPointerMode);

  const frameRef = useRef<number>(0);
  const lastInferenceRef = useRef<number>(0);
  const fpsClockRef = useRef<number>(0);
  const framesRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef(new GestureEngine());
  const showOverlayRef = useRef(showOverlay);
  const leftPinchLatchRef = useRef(false);
  const rightPinchLatchRef = useRef(false);
  const leftGrabLatchRef = useRef(false);
  const rightGrabLatchRef = useRef(false);
  const rightRingLatchRef = useRef(false);
  const prevRightRingRef = useRef(false);
  const lastPointerToggleAtRef = useRef(0);
  const lastGestureLabelRef = useRef('IDLE');
  const lastGestureDebugKeyRef = useRef('');

  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    let mounted = true;
    let landmarker: HandLandmarker | null = null;
    let stream: MediaStream | null = null;
    let prevLeft: HandData | null = null;
    let prevRight: HandData | null = null;

    const drawOverlay = (left: HandData | null, right: HandData | null) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!showOverlayRef.current) {
        return;
      }

      const drawHand = (hand: HandData, color: string) => {
        ctx.fillStyle = color;
        for (let i = 0; i < hand.landmarks.length; i += 1) {
          const p = hand.landmarks[i];
          const x = (1 - p.x) * width;
          const y = p.y * height;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      if (left) {
        drawHand(left, '#48b6ff');
      }
      if (right) {
        drawHand(right, '#7cf08b');
      }
    };

    const assignHands = (candidates: Candidate[]): { left: Candidate | null; right: Candidate | null } => {
      let left: Candidate | null = null;
      let right: Candidate | null = null;

      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        if (candidate.label === 'Left' && !left) {
          left = candidate;
          continue;
        }
        if (candidate.label === 'Right' && !right) {
          right = candidate;
          continue;
        }
      }

      if (!left && candidates.length > 0) {
        if (prevLeft) {
          left = nearest(prevLeft.centroid, candidates, right);
        } else {
          left = candidates[0];
        }
      }

      if (!right && candidates.length > 1) {
        if (prevRight) {
          right = nearest(prevRight.centroid, candidates, left);
        } else {
          right = candidates.find((c) => c !== left) ?? null;
        }
      }

      if (!right && candidates.length === 1 && candidates[0] !== left) {
        right = candidates[0];
      }

      return { left, right };
    };

    const nearest = (
      origin: Landmark,
      pool: Candidate[],
      exclude: Candidate | null
    ): Candidate | null => {
      let min = Number.POSITIVE_INFINITY;
      let found: Candidate | null = null;
      for (let i = 0; i < pool.length; i += 1) {
        if (pool[i] === exclude) {
          continue;
        }
        const d = distance3(origin, pool[i].centroid);
        if (d < min) {
          min = d;
          found = pool[i];
        }
      }
      return found;
    };

    const toCandidate = (
      landmarks: Landmark[],
      handedness: 'Left' | 'Right',
      confidence: number,
      previous: HandData | null
    ): Candidate => {
      const smoothed = emaLandmarks(landmarks, previous?.landmarks ?? null);
      const center = centroid(smoothed);
      const pinchDistance = distance3(smoothed[4], smoothed[8]);
      const grabDistance = distance3(smoothed[4], smoothed[12]);
      const ringPinchDistance = distance3(smoothed[4], smoothed[16]);
      return {
        landmarks: smoothed,
        label: handedness,
        confidence,
        centroid: center,
        pinchDistance,
        grabDistance,
        ringPinchDistance,
      };
    };

    const run = async () => {
      try {
        setTrackerStatus('loading');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        if (!mounted) {
          return;
        }

        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 960 },
            height: { ideal: 540 },
            facingMode: 'user',
          },
          audio: false,
        });

        const video = document.createElement('video');
        videoRef.current = video;
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          trackingRuntime.videoSize.width = canvas.width;
          trackingRuntime.videoSize.height = canvas.height;
        }

        setTrackerStatus('ready');
        fpsClockRef.current = performance.now();

        const tick = (now: number) => {
          if (!mounted || !landmarker || !videoRef.current) {
            return;
          }

          frameRef.current = requestAnimationFrame(tick);

          if (now - lastInferenceRef.current < TRACK_INTERVAL_MS) {
            return;
          }
          lastInferenceRef.current = now;

          const result = landmarker.detectForVideo(videoRef.current, now);
          const landmarksList = result.landmarks;
          const handednessList = result.handedness;

          const candidates: Candidate[] = [];
          for (let i = 0; i < landmarksList.length; i += 1) {
            const handInfo = handednessList[i]?.[0];
            if (!handInfo) {
              continue;
            }
            const label = handInfo.categoryName === 'Right' ? 'Right' : 'Left';
            const score = handInfo.score ?? 0.5;
            const lm = landmarksList[i].map((p) => ({ x: p.x, y: p.y, z: p.z }));
            const previous = label === 'Left' ? prevLeft : prevRight;
            candidates.push(toCandidate(lm, label, score, previous));
          }

          const assigned = assignHands(candidates);

          const left =
            assigned.left &&
            makeHandData(
              assigned.left.landmarks,
              'Left',
              assigned.left.confidence,
              assigned.left.centroid,
              assigned.left.pinchDistance,
              assigned.left.grabDistance
            );
          const right =
            assigned.right &&
            makeHandData(
              assigned.right.landmarks,
              'Right',
              assigned.right.confidence,
              assigned.right.centroid,
              assigned.right.pinchDistance,
              assigned.right.grabDistance
            );
          const rightRingPinchDistance = assigned.right?.ringPinchDistance ?? null;

          prevLeft = left ?? prevLeft;
          prevRight = right ?? prevRight;

          if (left) {
            leftPinchLatchRef.current = leftPinchLatchRef.current
              ? left.pinchDistance < PINCH_OFF
              : left.pinchDistance < PINCH_ON;
            leftGrabLatchRef.current = leftGrabLatchRef.current
              ? left.grabDistance < GRAB_OFF
              : left.grabDistance < GRAB_ON;
          } else {
            leftPinchLatchRef.current = false;
            leftGrabLatchRef.current = false;
          }

          if (right) {
            rightPinchLatchRef.current = rightPinchLatchRef.current
              ? right.pinchDistance < PINCH_OFF
              : right.pinchDistance < PINCH_ON;
            rightGrabLatchRef.current = rightGrabLatchRef.current
              ? right.grabDistance < GRAB_OFF
              : right.grabDistance < GRAB_ON;
            rightRingLatchRef.current = rightRingLatchRef.current
              ? rightRingPinchDistance !== null && rightRingPinchDistance < RING_PINCH_OFF
              : rightRingPinchDistance !== null && rightRingPinchDistance < RING_PINCH_ON;
          } else {
            rightPinchLatchRef.current = false;
            rightGrabLatchRef.current = false;
            rightRingLatchRef.current = false;
          }

          let leftPinch = false;
          let leftGrab = false;
          if (leftGrabLatchRef.current) {
            leftGrab = true;
          } else if (leftPinchLatchRef.current) {
            leftPinch = true;
          }

          let rightPinch = false;
          let rightGrab = false;
          if (rightGrabLatchRef.current) {
            rightGrab = true;
          } else if (rightPinchLatchRef.current) {
            rightPinch = true;
          }

          const rightRingTapStart = rightRingLatchRef.current && !prevRightRingRef.current;
          const canTogglePointerMode =
            rightRingTapStart &&
            !rightPinch &&
            !rightGrab &&
            now - lastPointerToggleAtRef.current > 320;
          if (canTogglePointerMode) {
            toggleRightPointerMode();
            lastPointerToggleAtRef.current = now;
          }
          prevRightRingRef.current = rightRingLatchRef.current;

          const bothPresent = Boolean(left && right);
          const gestures = engineRef.current.update(
            left?.landmarks ?? null,
            right?.landmarks ?? null,
            leftPinch,
            leftGrab,
            rightPinch,
            rightGrab,
            bothPresent
          );

          const rightPinchDistance = right ? right.pinchDistance : null;
          const rightGrabDistance = right ? right.grabDistance : null;
          const rightGesture = gestures.right;
          const debugKey = `${rightPinchDistance?.toFixed(4) ?? 'none'}|${rightGrabDistance?.toFixed(4) ?? 'none'}|${rightPinch}|${rightGrab}|${rightGesture}`;
          if (debugKey !== lastGestureDebugKeyRef.current) {
            lastGestureDebugKeyRef.current = debugKey;
            console.log({
              pinchDistance: rightPinchDistance,
              grabDistance: rightGrabDistance,
              pinch: rightPinch,
              grab: rightGrab,
              gesture: rightGesture,
            });
          }

          trackingRuntime.hands.left = left ?? null;
          trackingRuntime.hands.right = right ?? null;
          trackingRuntime.gestures = gestures;
          trackingRuntime.updatedAt = now;

          framesRef.current += 1;
          const dt = now - fpsClockRef.current;
          if (dt >= 500) {
            const fps = (framesRef.current * 1000) / dt;
            trackingRuntime.frameFps = fps;
            setFps(fps);
            fpsClockRef.current = now;
            framesRef.current = 0;
          }

          const gestureLabel = toGestureLabel(gestures.left, gestures.right);
          if (gestureLabel !== lastGestureLabelRef.current) {
            lastGestureLabelRef.current = gestureLabel;
            setCurrentGesture(gestureLabel);
          }
          drawOverlay(left ?? null, right ?? null);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (error) {
        console.error(error);
        setTrackerStatus('error');
      }
    };

    run();

    return () => {
      mounted = false;
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (landmarker) {
        landmarker.close();
      }
    };
  }, [canvasRef, setCurrentGesture, setFps, setTrackerStatus, toggleRightPointerMode]);
};

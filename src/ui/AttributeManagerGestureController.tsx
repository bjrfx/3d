import { useEffect } from 'react';
import { trackingRuntime } from '../tracking/runtime';
import { useInteractionStore } from '../stores/interactionStore';
import { mapControlPointerToScreen } from '../interaction/controlPointer';

const HOLD_MS = 220;
const HOVER_DWELL_MS = 90;
const CONTROL_COOLDOWN_MS = 160;
const SLIDER_DEADZONE_PX = 5;
const POINTER_SMOOTH_ALPHA = 0.38;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const dispatchInput = (input: HTMLInputElement, value: number) => {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const scrubSlider = (input: HTMLInputElement, start: number, deltaX: number, deltaY: number) => {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = Number(input.step || 1);
  const range = Math.max(0.0001, max - min);
  const delta = deltaX - deltaY * 0.5;
  const sensitivity = range <= 1 ? 0.003 : range <= 10 ? 0.007 : 0.01;
  const next = clamp(start + delta * range * sensitivity, min, max);
  const quantized = Math.round(next / step) * step;
  dispatchInput(input, quantized);
};

export const AttributeManagerGestureController = () => {
  const selectedObjectId = useInteractionStore((s) => s.selectedObjectId);
  const rightPointerMode = useInteractionStore((s) => s.rightPointerMode);

  useEffect(() => {
    const hoverStartedAtRef = { current: 0 };
    const hoveredControlRef = { current: null as string | null };
    const holdStartedAtRef = { current: 0 };
    const holdControlRef = { current: null as string | null };
    const activeSliderRef = { current: null as HTMLInputElement | null };
    const activeSliderControlRef = { current: null as string | null };
    const sliderStartValueRef = { current: 0 };
    const pinchStartXRef = { current: 0 };
    const pinchStartYRef = { current: 0 };
    const cooldownUntilRef = { current: 0 };
    const smoothXRef = { current: Number.NaN };
    const smoothYRef = { current: Number.NaN };

    const resetTransientState = () => {
      const ui = useInteractionStore.getState();
      ui.setPanelHoveredControl(null);
      ui.setPanelHoldProgress(0);
      ui.setPanelActiveControl(null);
      ui.setPanelInputLocked(false);
      hoveredControlRef.current = null;
      holdControlRef.current = null;
      hoverStartedAtRef.current = 0;
      holdStartedAtRef.current = 0;
      activeSliderRef.current = null;
      activeSliderControlRef.current = null;
      smoothXRef.current = Number.NaN;
      smoothYRef.current = Number.NaN;
    };

    let frame = 0;

    const tick = () => {
      const ui = useInteractionStore.getState();

      if (!selectedObjectId || rightPointerMode !== 'control') {
        if (ui.panelHoveredControl || ui.panelActiveControl || ui.panelInputLocked) {
          resetTransientState();
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      const right = trackingRuntime.hands.right;
      const rightState = trackingRuntime.gestures.right;
      const pinchActive = rightState === 'PINCH' || rightState === 'TRANSFORM';

      if (!right) {
        if (ui.panelHoveredControl || ui.panelActiveControl || ui.panelInputLocked) {
          resetTransientState();
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      const tip = right.landmarks[8] ?? right.centroid;
      const mapped = mapControlPointerToScreen(tip, window.innerWidth, window.innerHeight);
      if (Number.isNaN(smoothXRef.current) || Number.isNaN(smoothYRef.current)) {
        smoothXRef.current = mapped.x;
        smoothYRef.current = mapped.y;
      } else {
        smoothXRef.current = smoothXRef.current + (mapped.x - smoothXRef.current) * POINTER_SMOOTH_ALPHA;
        smoothYRef.current = smoothYRef.current + (mapped.y - smoothYRef.current) * POINTER_SMOOTH_ALPHA;
      }
      const x = smoothXRef.current;
      const y = smoothYRef.current;
      const now = performance.now();

      if (activeSliderRef.current && activeSliderControlRef.current) {
        if (!pinchActive) {
          ui.setPanelInputLocked(false);
          ui.setPanelActiveControl(null);
          ui.setPanelHoldProgress(0);
          activeSliderRef.current = null;
          activeSliderControlRef.current = null;
          holdControlRef.current = null;
          cooldownUntilRef.current = now + CONTROL_COOLDOWN_MS;
          frame = requestAnimationFrame(tick);
          return;
        }

        const deltaX = x - pinchStartXRef.current;
        const deltaY = y - pinchStartYRef.current;
        if (Math.hypot(deltaX, deltaY) >= SLIDER_DEADZONE_PX) {
          scrubSlider(activeSliderRef.current, sliderStartValueRef.current, deltaX, deltaY);
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!pinchActive) {
        ui.setPanelInputLocked(false);
        ui.setPanelActiveControl(null);
        ui.setPanelHoldProgress(0);
        holdControlRef.current = null;
        holdStartedAtRef.current = 0;
      }

      if (now < cooldownUntilRef.current) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const element = document.elementFromPoint(clamp(x, 0, window.innerWidth), clamp(y, 0, window.innerHeight)) as HTMLElement | null;
      const controlEl = element?.closest('[data-attr-control]') as HTMLElement | null;
      const controlId = controlEl?.dataset.attrControl ?? null;
      const controlType = controlEl?.dataset.attrControlType ?? null;

      if (controlId !== hoveredControlRef.current) {
        hoveredControlRef.current = controlId;
        hoverStartedAtRef.current = now;
        holdControlRef.current = null;
        holdStartedAtRef.current = 0;
        ui.setPanelHoldProgress(0);
      }

      ui.setPanelHoveredControl(controlId);

      if (!pinchActive || !controlEl || !controlId) {
        if (!pinchActive) {
          ui.setPanelHoldProgress(0);
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      if (now - hoverStartedAtRef.current < HOVER_DWELL_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }

      if (holdControlRef.current !== controlId) {
        holdControlRef.current = controlId;
        holdStartedAtRef.current = now;
        ui.setPanelHoldProgress(0);
        frame = requestAnimationFrame(tick);
        return;
      }

      const holdProgress = clamp((now - holdStartedAtRef.current) / HOLD_MS, 0, 1);
      ui.setPanelHoldProgress(holdProgress);

      if (holdProgress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      if (controlType === 'slider') {
        const inputControl =
          controlEl instanceof HTMLInputElement
            ? controlEl
            : (controlEl.querySelector('input') as HTMLInputElement | null);

        if (inputControl?.type === 'range') {
          activeSliderRef.current = inputControl;
          activeSliderControlRef.current = controlId;
          sliderStartValueRef.current = Number(inputControl.value || 0);
          pinchStartXRef.current = x;
          pinchStartYRef.current = y;
          ui.setPanelInputLocked(true);
          ui.setPanelActiveControl(controlId);
          ui.setPanelHoldProgress(1);
        } else {
          controlEl.click();
          ui.setPanelInputLocked(false);
          ui.setPanelActiveControl(null);
          ui.setPanelHoldProgress(0);
          holdControlRef.current = null;
          holdStartedAtRef.current = 0;
          cooldownUntilRef.current = now + CONTROL_COOLDOWN_MS;
        }
      } else {
        controlEl.click();
        ui.setPanelInputLocked(false);
        ui.setPanelActiveControl(null);
        ui.setPanelHoldProgress(0);
        holdControlRef.current = null;
        holdStartedAtRef.current = 0;
        cooldownUntilRef.current = now + CONTROL_COOLDOWN_MS;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      useInteractionStore.getState().clearPanelGestureState();
    };
  }, [selectedObjectId, rightPointerMode]);

  return null;
};

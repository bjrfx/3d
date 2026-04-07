import { useEffect, useState, type CSSProperties } from 'react';
import { trackingRuntime } from '../tracking/runtime';
import { useInteractionStore } from '../stores/interactionStore';
import { mapControlPointerToScreen } from '../interaction/controlPointer';

interface PointerState {
  x: number;
  y: number;
  visible: boolean;
  hoverProgress: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const CLICK_COOLDOWN_MS = 140;
const HOVER_ACTIVATION_MS = 400;
const SCROLL_INPUT_ALPHA = 0.34;
const SCROLL_DELTA_DEADZONE = 0.0007;
const SCROLL_DELTA_GAIN = 2100;
const SCROLL_TARGET_LERP = 0.42;

const isNativeInteractive = (el: HTMLElement): boolean => {
  return (
    el.matches('button') ||
    el.matches('a') ||
    el.matches('input') ||
    el.matches('[role="button"]') ||
    el.matches('[aria-pressed]')
  );
};

export const ControlPointerController = () => {
  const rightPointerMode = useInteractionStore((s) => s.rightPointerMode);
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0, visible: false, hoverProgress: 0 });

  useEffect(() => {
    const hoveredInteractiveRef = { current: null as HTMLElement | null };
    const hoverStartedAtRef = { current: 0 };
    const activatedDuringHoverRef = { current: false };
    const cooldownUntilRef = { current: 0 };
    const scrollContainerRef = { current: null as HTMLElement | null };
    const scrollInputYRef = { current: Number.NaN };
    const scrollPrevYRef = { current: Number.NaN };
    const scrollTargetTopRef = { current: 0 };
    const scrollCurrentTopRef = { current: 0 };
    const wasPinchingForScrollRef = { current: false };
    let frame = 0;

    const clearHover = () => {
      if (hoveredInteractiveRef.current) {
        hoveredInteractiveRef.current.classList.remove('is-control-hover');
        hoveredInteractiveRef.current = null;
      }
      hoverStartedAtRef.current = 0;
      activatedDuringHoverRef.current = false;
    };

    const setHover = (element: HTMLElement | null) => {
      if (hoveredInteractiveRef.current === element) {
        return;
      }
      if (hoveredInteractiveRef.current) {
        hoveredInteractiveRef.current.classList.remove('is-control-hover');
      }
      hoveredInteractiveRef.current = element;
      hoverStartedAtRef.current = performance.now();
      activatedDuringHoverRef.current = false;
      if (element) {
        element.classList.add('is-control-hover');
      }
    };

    const resetStates = () => {
      clearHover();
      wasPinchingForScrollRef.current = false;
      scrollContainerRef.current = null;
      scrollInputYRef.current = Number.NaN;
      scrollPrevYRef.current = Number.NaN;
      scrollTargetTopRef.current = 0;
      scrollCurrentTopRef.current = 0;
    };

    const tick = () => {
      const right = trackingRuntime.hands.right;
      const rightState = trackingRuntime.gestures.right;
      const scrollPinchActive = rightState === 'GRAB';
      const now = performance.now();

      if (rightPointerMode !== 'control' || !right) {
        if (pointer.visible) {
          setPointer((prev) => ({ ...prev, visible: false, hoverProgress: 0 }));
        }
        resetStates();
        frame = requestAnimationFrame(tick);
        return;
      }

      const tip = right.landmarks[8] ?? right.centroid;
      const rawIndexY = tip.y;
      const mapped = mapControlPointerToScreen(tip, window.innerWidth, window.innerHeight);
      const x = mapped.x;
      const y = mapped.y;

      const element = document.elementFromPoint(
        clamp(x, 0, window.innerWidth),
        clamp(y, 0, window.innerHeight)
      ) as HTMLElement | null;
      const attrControl = element?.closest('[data-attr-control]') as HTMLElement | null;
      const attrControlType = attrControl?.dataset.attrControlType ?? null;
      const drawerContent = element?.closest('.property-drawer__content') as HTMLElement | null;

      const interactive = !attrControl || attrControlType === 'button'
        ? (element?.closest('button') as HTMLElement | null) ??
          (element?.closest('a') as HTMLElement | null) ??
          (element?.closest('input') as HTMLElement | null) ??
          (element?.closest('[role="button"]') as HTMLElement | null) ??
          null
        : null;

      const blockedBackdrop = interactive?.classList.contains('property-drawer__backdrop') ?? false;
      const validInteractive = interactive && isNativeInteractive(interactive) && !blockedBackdrop ? interactive : null;

      if (!scrollPinchActive) {
        setHover(validInteractive);
      }

      let hoverProgress = 0;
      if (hoveredInteractiveRef.current && !scrollPinchActive) {
        hoverProgress = clamp(
          (now - hoverStartedAtRef.current) / HOVER_ACTIVATION_MS,
          0,
          1
        );
      }
      setPointer({ x, y, visible: true, hoverProgress });

      if (
        hoveredInteractiveRef.current &&
        !activatedDuringHoverRef.current &&
        hoverProgress >= 1 &&
        !scrollPinchActive &&
        now >= cooldownUntilRef.current
      ) {
        hoveredInteractiveRef.current.click();
        activatedDuringHoverRef.current = true;
        cooldownUntilRef.current = now + CLICK_COOLDOWN_MS;
      }

      if (!scrollPinchActive) {
        wasPinchingForScrollRef.current = false;
        scrollContainerRef.current = null;
        scrollInputYRef.current = Number.NaN;
        scrollPrevYRef.current = Number.NaN;
        scrollTargetTopRef.current = 0;
        scrollCurrentTopRef.current = 0;
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!wasPinchingForScrollRef.current) {
        wasPinchingForScrollRef.current = true;
        clearHover();
        if (drawerContent && attrControlType !== 'slider') {
          scrollContainerRef.current = drawerContent;
          scrollInputYRef.current = rawIndexY;
          scrollPrevYRef.current = rawIndexY;
          scrollTargetTopRef.current = drawerContent.scrollTop;
          scrollCurrentTopRef.current = drawerContent.scrollTop;
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      const scrollingContainer = scrollContainerRef.current;
      if (scrollingContainer && attrControlType !== 'slider') {
        if (Number.isNaN(scrollInputYRef.current)) {
          scrollInputYRef.current = rawIndexY;
        }
        if (Number.isNaN(scrollPrevYRef.current)) {
          scrollPrevYRef.current = rawIndexY;
        }

        scrollInputYRef.current =
          scrollInputYRef.current + (rawIndexY - scrollInputYRef.current) * SCROLL_INPUT_ALPHA;

        const smoothIndexY = scrollInputYRef.current;
        const deltaNorm = smoothIndexY - scrollPrevYRef.current;
        scrollPrevYRef.current = smoothIndexY;

        const adjustedDelta =
          Math.abs(deltaNorm) <= SCROLL_DELTA_DEADZONE
            ? 0
            : deltaNorm - Math.sign(deltaNorm) * SCROLL_DELTA_DEADZONE;

        const maxScrollTop = Math.max(0, scrollingContainer.scrollHeight - scrollingContainer.clientHeight);
        scrollTargetTopRef.current = clamp(
          scrollTargetTopRef.current - adjustedDelta * SCROLL_DELTA_GAIN,
          0,
          maxScrollTop
        );

        scrollCurrentTopRef.current =
          scrollCurrentTopRef.current +
          (scrollTargetTopRef.current - scrollCurrentTopRef.current) * SCROLL_TARGET_LERP;

        scrollingContainer.scrollTop = scrollCurrentTopRef.current;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resetStates();
    };
  }, [pointer.visible, rightPointerMode]);

  return (
    <div
      className={[
        'control-pointer-cursor',
        pointer.visible && rightPointerMode === 'control' ? 'is-visible' : '',
        pointer.hoverProgress > 0 && rightPointerMode === 'control' ? 'is-arming' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${pointer.x}px`,
        top: `${pointer.y}px`,
        '--hover-progress': String(pointer.hoverProgress),
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className="control-pointer-cursor__ring" />
    </div>
  );
};

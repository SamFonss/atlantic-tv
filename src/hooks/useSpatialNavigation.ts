/* ==========================================================================
   SPATIAL NAVIGATION SYSTEM — TV Remote Friendly
   Handles focus management for 10ft UI with directional navigation
   ========================================================================== */

import { useEffect, useRef, useCallback, useState } from 'react';

interface SpatialNavConfig {
  selector?: string;
  container?: HTMLElement | null;
  onEnter?: (element: HTMLElement) => void;
  onBack?: () => boolean;
  wrapX?: boolean;
  wrapY?: boolean;
  debug?: boolean;
}

interface FocusableElement extends HTMLElement {
  __spatialNavId?: number;
}

function getDistance(a: DOMRect, b: DOMRect, direction: 'up' | 'down' | 'left' | 'right'): number {
  const aCenterX = a.left + a.width / 2;
  const aCenterY = a.top + a.height / 2;
  const bCenterX = b.left + b.width / 2;
  const bCenterY = b.top + b.height / 2;

  let dx = 0, dy = 0;

  switch (direction) {
    case 'left':
      if (bCenterX >= aCenterX) return Infinity;
      dx = aCenterX - bCenterX;
      dy = Math.abs(aCenterY - bCenterY);
      break;
    case 'right':
      if (bCenterX <= aCenterX) return Infinity;
      dx = bCenterX - aCenterX;
      dy = Math.abs(aCenterY - bCenterY);
      break;
    case 'up':
      if (bCenterY >= aCenterY) return Infinity;
      dx = Math.abs(aCenterX - bCenterX);
      dy = aCenterY - bCenterY;
      break;
    case 'down':
      if (bCenterY <= aCenterY) return Infinity;
      dx = Math.abs(aCenterX - bCenterX);
      dy = bCenterY - aCenterY;
      break;
  }

  return dx * 1 + dy * 0.3;
}

function getFocusableElements(container: HTMLElement, selector = '[data-focusable]'): FocusableElement[] {
  return Array.from(container.querySelectorAll<FocusableElement>(selector))
    .filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
}

function findBestCandidate(
  current: FocusableElement,
  candidates: FocusableElement[],
  direction: 'up' | 'down' | 'left' | 'right'
): FocusableElement | null {
  const currentRect = current.getBoundingClientRect();
  let best: FocusableElement | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (candidate === current) continue;
    const rect = candidate.getBoundingClientRect();
    const distance = getDistance(currentRect, rect, direction);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

export function useSpatialNavigation(config: SpatialNavConfig = {}) {
  const {
    selector = '[data-focusable]',
    container: containerRef,
    onEnter,
    onBack,
    wrapX = false,
    wrapY = false,
    debug = false,
  } = config;

  const [focusedElement, setFocusedElement] = useState<FocusableElement | null>(null);
  const elementsRef = useRef<FocusableElement[]>([]);
  const currentIndexRef = useRef(-1);
  const mountedRef = useRef(false);

  const refresh = useCallback(() => {
    const container = containerRef || document.body;
    elementsRef.current = getFocusableElements(container, selector);

    elementsRef.current.forEach((el, i) => {
      el.__spatialNavId = i;
    });

    if (debug) {
      console.log('[SpatialNav] Refreshed:', elementsRef.current.length, 'elements');
    }
  }, [containerRef, selector, debug]);

  const focus = useCallback((element: FocusableElement | null, scroll = true) => {
    if (!element) {
      setFocusedElement(null);
      currentIndexRef.current = -1;
      return;
    }

    const index = elementsRef.current.indexOf(element);
    if (index === -1) {
      elementsRef.current.push(element);
      element.__spatialNavId = elementsRef.current.length - 1;
    }

    setFocusedElement(element);
    currentIndexRef.current = elementsRef.current.indexOf(element);

    element.focus({ preventScroll: !scroll });

    if (scroll) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    if (debug) {
      console.log('[SpatialNav] Focused:', element.__spatialNavId, element.tagName, element.className);
    }
  }, [debug]);

  const navigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!focusedElement || elementsRef.current.length === 0) {
      refresh();
      if (elementsRef.current.length > 0) {
        focus(elementsRef.current[0]);
      }
      return;
    }

    const candidates = elementsRef.current.filter(el => el !== focusedElement);
    if (candidates.length === 0) return;

    const best = findBestCandidate(focusedElement, candidates, direction);

    if (best) {
      focus(best);
    } else if ((direction === 'left' || direction === 'right') && wrapX) {
      const opposite = direction === 'left' ? 'right' : 'left';
      const wrapped = findBestCandidate(focusedElement, candidates, opposite);
      if (wrapped) focus(wrapped);
    } else if ((direction === 'up' || direction === 'down') && wrapY) {
      const opposite = direction === 'up' ? 'down' : 'up';
      const wrapped = findBestCandidate(focusedElement, candidates, opposite);
      if (wrapped) focus(wrapped);
    }
  }, [focusedElement, focus, wrapX, wrapY, refresh, debug]);

  const handleEnter = useCallback(() => {
    if (focusedElement && onEnter) {
      onEnter(focusedElement);
    } else if (focusedElement) {
      (focusedElement as HTMLElement).click();
    }
  }, [focusedElement, onEnter]);

  const handleBack = useCallback(() => {
    if (onBack) {
      return onBack();
    }
    return false;
  }, [onBack]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const keyMap: Record<string, 'up' | 'down' | 'left' | 'right' | 'enter' | 'back'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Enter: 'enter',
      ' ': 'enter',
      Escape: 'back',
      Backspace: 'back',
      GamepadFaceButton0: 'enter',
      GamepadFaceButton1: 'back',
      GamepadDPadUp: 'up',
      GamepadDPadDown: 'down',
      GamepadDPadLeft: 'left',
      GamepadDPadRight: 'right',
    };

    const action = keyMap[e.key] || keyMap[e.code];

    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        navigate(action);
        break;
      case 'enter':
        handleEnter();
        break;
      case 'back':
        handleBack();
        break;
    }
  }, [navigate, handleEnter, handleBack]);

  const gamepadPollRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastGamepadStateRef = useRef<Record<string, number>>({});

  const startGamepadPolling = useCallback(() => {
    const poll = (time: number) => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;

        const axes = gp.axes;
        const buttons = gp.buttons;
        const deadzone = 0.3;

        if (axes[0] < -deadzone) {
          const key = 'GamepadDPadLeft';
          if (!lastGamepadStateRef.current[key]) {
            lastGamepadStateRef.current[key] = time;
            navigate('left');
          }
        } else if (axes[0] > deadzone) {
          const key = 'GamepadDPadRight';
          if (!lastGamepadStateRef.current[key]) {
            lastGamepadStateRef.current[key] = time;
            navigate('right');
          }
        } else {
          delete lastGamepadStateRef.current['GamepadDPadLeft'];
          delete lastGamepadStateRef.current['GamepadDPadRight'];
        }

        if (axes[1] < -deadzone) {
          const key = 'GamepadDPadUp';
          if (!lastGamepadStateRef.current[key]) {
            lastGamepadStateRef.current[key] = time;
            navigate('up');
          }
        } else if (axes[1] > deadzone) {
          const key = 'GamepadDPadDown';
          if (!lastGamepadStateRef.current[key]) {
            lastGamepadStateRef.current[key] = time;
            navigate('down');
          }
        } else {
          delete lastGamepadStateRef.current['GamepadDPadUp'];
          delete lastGamepadStateRef.current['GamepadDPadDown'];
        }

        if (buttons[0]?.pressed) {
          const key = 'GamepadFaceButton0';
          if (!lastGamepadStateRef.current[key]) {
            lastGamepadStateRef.current[key] = time;
            handleEnter();
          }
        } else {
          delete lastGamepadStateRef.current['GamepadFaceButton0'];
        }

        if (buttons[1]?.pressed) {
          const key = 'GamepadFaceButton1';
          if (!lastGamepadStateRef.current[key]) {
            lastGamepadStateRef.current[key] = time;
            handleBack();
          }
        } else {
          delete lastGamepadStateRef.current['GamepadFaceButton1'];
        }
      }

      gamepadPollRef.current = requestAnimationFrame(poll);
    };

    gamepadPollRef.current = requestAnimationFrame(poll);
  }, [navigate, handleEnter, handleBack]);

  const stopGamepadPolling = useCallback(() => {
    if (gamepadPollRef.current) {
      cancelAnimationFrame(gamepadPollRef.current);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    if (elementsRef.current.length > 0 && !focusedElement) {
      focus(elementsRef.current[0], false);
    }

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('gamepadconnected', startGamepadPolling);
    window.addEventListener('gamepaddisconnected', stopGamepadPolling);

    if (navigator.getGamepads()[0]) {
      startGamepadPolling();
    }

    return () => {
      mountedRef.current = false;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('gamepadconnected', startGamepadPolling);
      window.removeEventListener('gamepaddisconnected', stopGamepadPolling);
      stopGamepadPolling();
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  return {
    focusedElement,
    focus,
    navigate,
    refresh,
    elements: elementsRef.current,
  };
}

export function useFocusable<T extends HTMLElement = HTMLElement>(options: {
  id?: string;
  priority?: number;
  onFocus?: () => void;
  onBlur?: () => void;
} = {}) {
  const elementRef = useRef<T>(null);
  const { id, priority = 0, onFocus, onBlur } = options;

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    el.setAttribute('data-focusable', '');
    if (id) el.setAttribute('data-focus-id', id);
    el.dataset.focusPriority = String(priority);

    const handleFocus = () => onFocus?.();
    const handleBlur = () => onBlur?.();

    el.addEventListener('focus', handleFocus);
    el.addEventListener('blur', handleBlur);

    return () => {
      el.removeEventListener('focus', handleFocus);
      el.removeEventListener('blur', handleBlur);
      el.removeAttribute('data-focusable');
      if (id) el.removeAttribute('data-focus-id');
      delete el.dataset.focusPriority;
    };
  }, [id, priority, onFocus, onBlur]);

  return elementRef;
}
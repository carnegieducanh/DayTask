import { useEffect, RefObject } from 'react';

type ScrollState = { current: number; target: number; rafId: number; lastTime: number };

// Easing rate (per second) of every wheel glide in the app, vertical and horizontal: higher brakes
// harder and settles sooner. At 8 one notch (~50px) settles in ~0.58s, 90% of the way by ~0.29s.
const EASE_RATE = 8;

// Core logic — attach smooth scroll to el AND any inner scrollable children.
export function attachSmoothScroll(el: HTMLElement): () => void {
  const states = new Map<HTMLElement, ScrollState>();

  function getState(node: HTMLElement): ScrollState {
    let s = states.get(node);
    if (!s) {
      s = { current: node.scrollTop, target: node.scrollTop, rafId: 0, lastTime: 0 };
      states.set(node, s);
    } else if (!s.rafId) {
      // Idle: pick up scrolling done outside this hook (scrollbar drag, focus,
      // keyboard). Inner scrollers get no onScroll sync, so without this the
      // next wheel would start from a stale position and jump back.
      s.current = node.scrollTop;
      s.target = node.scrollTop;
    }
    return s;
  }

  function scheduleTick(scrollEl: HTMLElement) {
    function tick(time: number) {
      const s = getState(scrollEl);
      if (!s.lastTime) s.lastTime = time;
      const dt = Math.min((time - s.lastTime) / 1000, 0.05);
      s.lastTime = time;
      const factor = 1 - Math.exp(-dt * EASE_RATE);
      s.current += (s.target - s.current) * factor;
      if (Math.abs(s.target - s.current) > 0.5) {
        scrollEl.scrollTop = s.current;
        s.rafId = requestAnimationFrame(tick);
      } else {
        scrollEl.scrollTop = s.target;
        s.current = s.target;
        s.rafId = 0;
        s.lastTime = 0;
      }
    }
    return tick;
  }

  function smoothScroll(scrollEl: HTMLElement, delta: number) {
    const s = getState(scrollEl);
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
    s.target = Math.max(0, Math.min(s.target + delta, maxScroll));
    if (!s.rafId) s.rafId = requestAnimationFrame(scheduleTick(scrollEl));
  }

  function onWheel(e: WheelEvent) {
    // Textareas manage their own scroll position to keep the caret in view while typing.
    // Hijacking a *nested* textarea's wheel scroll from an ancestor's handler fights that
    // native behavior and makes the caret/content jump around — let the browser handle it
    // natively (it already chains to the parent scroll container once the textarea hits its
    // own scroll limit). This only applies when `el` is an ancestor; if `el` IS the textarea
    // (smooth scroll attached directly to it), let it scroll itself as usual.
    if (e.target instanceof HTMLTextAreaElement && e.target !== el) return;

    const delta =
      e.deltaMode === 0 ? e.deltaY * 0.5 :
      e.deltaMode === 1 ? e.deltaY * 20 :
      e.deltaY * el.clientHeight * 0.5;

    // Walk up from target — find the innermost scrollable child that can absorb this scroll
    let node = e.target as HTMLElement | null;
    while (node && node !== el) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
        const goingDown = delta > 0;
        const childTarget = getState(node).target;
        const maxScroll = node.scrollHeight - node.clientHeight;
        const atBottom = childTarget >= maxScroll - 1;
        const atTop = childTarget <= 0;
        if ((goingDown && !atBottom) || (!goingDown && !atTop)) {
          e.preventDefault();
          smoothScroll(node, delta);
          return;
        }
      }
      node = node.parentElement;
    }

    // Fall through to the root el — only if it can actually scroll
    const elOy = getComputedStyle(el).overflowY;
    if ((elOy === 'auto' || elOy === 'scroll') && el.scrollHeight > el.clientHeight) {
      e.preventDefault();
      smoothScroll(el, delta);
    }
  }

  function onScroll() {
    const s = getState(el);
    if (s.rafId) {
      // If scrollTop differs significantly from the animation's current position,
      // it was an external programmatic scroll — cancel animation and sync.
      if (Math.abs(el.scrollTop - s.current) > 1.5) {
        cancelAnimationFrame(s.rafId);
        s.rafId = 0;
        s.lastTime = 0;
        s.current = el.scrollTop;
        s.target = el.scrollTop;
      }
    } else {
      s.current = el.scrollTop;
      s.target = el.scrollTop;
    }
  }

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('scroll', onScroll);
    for (const s of states.values()) {
      if (s.rafId) cancelAnimationFrame(s.rafId);
    }
    states.clear();
  };
}

// React hook wrapping the utility — for single-ref usage.
export function useSmoothScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachSmoothScroll(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Horizontal sibling for a single-row strip (tab bars): the vertical mouse wheel scrolls `el`
// sideways with the same easing curve as attachSmoothScroll. Wheel events are taken from `area`, which
// may be a wrapper that also covers overlay controls (e.g. scroll arrows). Horizontal trackpad
// swipes are left to the browser, and Shift+wheel to the app (Sidebar uses it to switch tabs).
export function attachSmoothScrollX(el: HTMLElement, area: HTMLElement = el): () => void {
  const s: ScrollState = { current: el.scrollLeft, target: el.scrollLeft, rafId: 0, lastTime: 0 };

  function tick(time: number) {
    if (!s.lastTime) s.lastTime = time;
    const dt = Math.min((time - s.lastTime) / 1000, 0.05);
    s.lastTime = time;
    const factor = 1 - Math.exp(-dt * EASE_RATE);
    s.current += (s.target - s.current) * factor;
    if (Math.abs(s.target - s.current) > 0.5) {
      el.scrollLeft = s.current;
      s.rafId = requestAnimationFrame(tick);
    } else {
      el.scrollLeft = s.target;
      s.current = s.target;
      s.rafId = 0;
      s.lastTime = 0;
    }
  }

  function onWheel(e: WheelEvent) {
    if (e.shiftKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    e.preventDefault();
    if (!s.rafId) {
      s.current = el.scrollLeft;
      s.target = el.scrollLeft;
    }
    const delta =
      e.deltaMode === 0 ? e.deltaY * 0.5 :
      e.deltaMode === 1 ? e.deltaY * 20 :
      e.deltaY * el.clientWidth * 0.5;
    s.target = Math.max(0, Math.min(s.target + delta, maxScroll));
    if (!s.rafId) s.rafId = requestAnimationFrame(tick);
  }

  // Same sync as attachSmoothScroll's onScroll: an outside scroll (arrow buttons, trackpad,
  // focus) cancels a running glide so the next wheel starts from where the strip really is.
  function onScroll() {
    if (s.rafId) {
      if (Math.abs(el.scrollLeft - s.current) > 1.5) {
        cancelAnimationFrame(s.rafId);
        s.rafId = 0;
        s.lastTime = 0;
        s.current = el.scrollLeft;
        s.target = el.scrollLeft;
      }
    } else {
      s.current = el.scrollLeft;
      s.target = el.scrollLeft;
    }
  }

  area.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    area.removeEventListener('wheel', onWheel);
    el.removeEventListener('scroll', onScroll);
    if (s.rafId) cancelAnimationFrame(s.rafId);
  };
}

// `areaRef` defaults to the strip itself. `active` re-attaches when a conditionally rendered
// strip mounts after the component did.
export function useSmoothScrollX(
  ref: RefObject<HTMLElement | null>,
  areaRef: RefObject<HTMLElement | null> = ref,
  active = true,
) {
  useEffect(() => {
    const el = ref.current;
    const area = areaRef.current;
    if (!active || !el || !area) return;
    return attachSmoothScrollX(el, area);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

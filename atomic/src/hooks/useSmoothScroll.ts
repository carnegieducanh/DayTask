import { useEffect, RefObject } from 'react';

type ScrollState = { current: number; target: number; rafId: number; lastTime: number };

// Core logic — attach smooth scroll to el AND any inner scrollable children.
export function attachSmoothScroll(el: HTMLElement): () => void {
  const states = new Map<HTMLElement, ScrollState>();

  function getState(node: HTMLElement): ScrollState {
    let s = states.get(node);
    if (!s) {
      s = { current: node.scrollTop, target: node.scrollTop, rafId: 0, lastTime: 0 };
      states.set(node, s);
    }
    return s;
  }

  function scheduleTick(scrollEl: HTMLElement) {
    function tick(time: number) {
      const s = getState(scrollEl);
      if (!s.lastTime) s.lastTime = time;
      const dt = Math.min((time - s.lastTime) / 1000, 0.05);
      s.lastTime = time;
      const factor = 1 - Math.exp(-dt * 6);
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

    // Fall through to the root el
    e.preventDefault();
    smoothScroll(el, delta);
  }

  function onScroll() {
    const s = getState(el);
    if (!s.rafId) {
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

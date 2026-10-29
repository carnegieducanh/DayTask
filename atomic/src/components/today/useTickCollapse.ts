import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useAppStore } from "../../store/appStore";
import type { Task } from "../../types";

// Same timing as the old Today Pending list: collapse runs 600ms, the task
// flips to done once it's gone.
const COLLAPSE_MS = 640;

type Pos = { x: number; y: number };

// Margin that cancels the flex gap next to a block, so a 0-height block takes
// no space at all while it collapses / grows.
function gapKeyframes(el: HTMLElement): [Keyframe, Keyframe] {
  const gap = parseFloat(getComputedStyle(el.parentElement!).rowGap) || 0;
  const side = el.nextElementSibling ? "marginBottom" : el.previousElementSibling ? "marginTop" : null;
  return side ? [{ [side]: "0px" }, { [side]: `${-gap}px` }] : [{}, {}];
}

// Position inside root's content, so scrolling root (or the page) between
// renders never reads as movement.
function toPos(r: DOMRect, root: HTMLElement, origin: DOMRect): Pos {
  return { x: r.left - origin.left + root.scrollLeft, y: r.top - origin.top + root.scrollTop };
}

// Tick animation shared by the week strip and the "Today" agenda. Completing
// a pending block replays the old Pending-list exit: tick shows at once, the
// block collapses + fades + drops 10px, then the task flips and grows back in
// at its done spot; every other re-sort slides blocks via FLIP. Blocks are
// grouped by their parent element (a day column / the agenda list).
// `doneIds` = rendered tasks that are done right now.
// No prefers-reduced-motion opt-out (same as the rest of the app): Windows
// with "Animation effects" off reports it, and that hid these entirely.
export function useTickCollapse(rootRef: RefObject<HTMLElement | null>, doneIds: Set<number>) {
  const toggleTask = useAppStore((s) => s.toggleTask);

  const blockEls = useRef(new Map<number, HTMLElement>());
  const prevPos = useRef(new Map<number, Pos>());

  // `collapsing` holds the fill:forwards animations that keep the block
  // hidden until the re-sorted render.
  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());
  const collapsing = useRef(new Map<number, { el: HTMLElement; container: HTMLElement; anims: Animation[] }>());
  // Containers keep their height while a block leaves and comes back, so the
  // page below doesn't bounce.
  const heightLocks = useRef(new Map<HTMLElement, number>());

  function lockHeight(container: HTMLElement) {
    const n = heightLocks.current.get(container) ?? 0;
    if (n === 0) container.style.minHeight = `${container.offsetHeight}px`;
    heightLocks.current.set(container, n + 1);
  }
  function unlockHeight(container: HTMLElement) {
    const n = (heightLocks.current.get(container) ?? 1) - 1;
    if (n > 0) {
      heightLocks.current.set(container, n);
      return;
    }
    heightLocks.current.delete(container);
    container.style.minHeight = "";
  }

  function recordPositions(container: Element) {
    const root = rootRef.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    blockEls.current.forEach((el, id) => {
      if (el.parentElement === container) prevPos.current.set(id, toPos(el.getBoundingClientRect(), root, origin));
    });
  }

  function blockRef(id: number) {
    return (el: HTMLElement | null) => {
      if (el) blockEls.current.set(id, el);
      else blockEls.current.delete(id);
    };
  }

  function handleTick(task: Task) {
    const el = blockEls.current.get(task.id);
    const container = el?.parentElement;
    if (task.is_done || !el || !container) {
      toggleTask(task.id);
      return;
    }
    if (collapsing.current.has(task.id)) return;

    setCheckingIds((prev) => new Set(prev).add(task.id));
    lockHeight(container);
    const [gapShown, gapHidden] = gapKeyframes(el);
    collapsing.current.set(task.id, {
      el,
      container,
      anims: [
        el.animate([{ height: `${el.offsetHeight}px`, ...gapShown }, { height: "0px", ...gapHidden }], {
          duration: 600,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        }),
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: "ease", fill: "forwards" }),
        el.animate([{ transform: "none" }, { transform: "translateY(10px)" }], {
          duration: 550,
          easing: "ease",
          fill: "forwards",
        }),
      ],
    });

    setTimeout(() => {
      // The collapse already slid the blocks below into place — start the
      // re-sort FLIP from here, not from where they were before the tick.
      recordPositions(container);
      toggleTask(task.id).finally(() => {
        // Next macrotask: the re-sorted render has committed by now.
        setTimeout(() => {
          const stuck = collapsing.current.get(task.id);
          if (stuck) {
            // Toggle failed (task still pending) — bring the block back.
            stuck.anims.forEach((a) => a.cancel());
            collapsing.current.delete(task.id);
            unlockHeight(stuck.container);
          }
          setCheckingIds((prev) => {
            const s = new Set(prev);
            s.delete(task.id);
            return s;
          });
        }, 0);
      });
    }, COLLAPSE_MS);
  }

  // FLIP: when a tick re-sorts a container, slide blocks from their old spot
  // to the new one instead of jumping.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const hadPrev = prevPos.current.size > 0;

    // Collapsed blocks whose task is now done: drop the hold so they can grow
    // back in at their new (bottom) spot. Ones re-sorted out of view (behind
    // the week strip's "+n") just end there.
    const growIn = new Map<number, HTMLElement>();
    const busy = new Set<Element>();
    collapsing.current.forEach(({ el: held, container, anims }, id) => {
      const el = blockEls.current.get(id);
      if (el === held && !doneIds.has(id)) {
        busy.add(container);
        return;
      }
      anims.forEach((a) => a.cancel());
      collapsing.current.delete(id);
      if (el === held && el.parentElement === container) growIn.set(id, container);
      else unlockHeight(container);
    });

    const next = new Map<number, Pos>();
    blockEls.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      const pos = toPos(r, root, origin);
      next.set(id, pos);
      const container = growIn.get(id);
      if (container) {
        const [gapShown, gapHidden] = gapKeyframes(el);
        el.animate(
          [
            { height: "0px", opacity: 0, transform: "translateY(-6px)", ...gapHidden },
            { height: `${r.height}px`, opacity: 1, transform: "none", ...gapShown },
          ],
          { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ).finished.then(
          () => unlockHeight(container),
          () => unlockHeight(container),
        );
        return;
      }
      // Its container is mid-collapse; the layout itself is moving there.
      if (el.parentElement && busy.has(el.parentElement)) return;
      const prev = prevPos.current.get(id);
      if (prev) {
        const dx = prev.x - pos.x;
        const dy = prev.y - pos.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
            duration: 450,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          });
        }
      } else if (hadPrev) {
        // A block that wasn't shown before (behind "+n", another day) slides
        // into view.
        el.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], {
          duration: 300,
          easing: "ease-out",
        });
      }
    });
    prevPos.current = next;
  });

  return { checkingIds, blockRef, handleTick };
}

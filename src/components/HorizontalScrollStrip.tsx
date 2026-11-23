import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollStripProps {
  children: React.ReactNode;
  scrollerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  ariaLabel?: string;
  showArrows?: boolean;
}

export const HorizontalScrollStrip: React.FC<HorizontalScrollStripProps> = ({
  children,
  scrollerRef,
  className = '',
  ariaLabel,
  showArrows = true,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const elRef = scrollerRef || internalRef;

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    hasMoved: false,
  });

  const updateScrollEdges = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
  }, [elRef]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    updateScrollEdges();

    const handleScroll = () => updateScrollEdges();
    el.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateScrollEdges();
    });
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(() => {
      updateScrollEdges();
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    // Convert vertical mouse-wheel scrolling over the strip into horizontal scrolling
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('wheel', handleWheel);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [elRef, updateScrollEdges]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only apply mouse drag-to-scroll; touch & pen keep native momentum swipe
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = elRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;

    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      hasMoved: false,
    };

    const handleWindowMove = (moveEvt: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state.active) return;
      const dx = moveEvt.clientX - state.startX;
      if (!state.hasMoved && Math.abs(dx) > 4) {
        state.hasMoved = true;
        setIsDragging(true);
      }
      if (state.hasMoved && elRef.current) {
        elRef.current.scrollLeft = state.startScrollLeft - dx;
      }
    };

    const handleWindowUp = () => {
      const state = dragStateRef.current;
      const moved = state.hasMoved;
      state.active = false;
      state.hasMoved = false;
      setIsDragging(false);

      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);

      if (moved && elRef.current) {
        const blockClick = (clickEvt: MouseEvent) => {
          clickEvt.preventDefault();
          clickEvt.stopPropagation();
        };
        const targetEl = elRef.current;
        targetEl.addEventListener('click', blockClick, { capture: true, once: true });
        window.setTimeout(() => {
          targetEl.removeEventListener('click', blockClick, { capture: true });
        }, 50);
      }
    };

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
  };

  const scrollByStep = (direction: 'left' | 'right') => {
    const el = elRef.current;
    if (!el) return;
    const step = Math.max(180, Math.round(el.clientWidth * 0.55));
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  const isOverflowing = canScrollLeft || canScrollRight;

  return (
    <div className="relative flex items-center gap-1.5 min-w-0">
      {showArrows && isOverflowing && (
        <button
          type="button"
          onClick={() => scrollByStep('left')}
          disabled={!canScrollLeft}
          aria-label="រំកិលទៅឆ្វេង"
          title="រំកិលទៅឆ្វេង"
          className={`hidden sm:flex items-center justify-center w-8 h-10 rounded-xl border shrink-0 transition-all ${
            canScrollLeft
              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs active:scale-95'
              : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-default'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <div
        ref={elRef}
        role={ariaLabel ? 'region' : undefined}
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onDragStart={(e) => e.preventDefault()}
        className={`flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none ${
          isOverflowing
            ? isDragging
              ? 'cursor-grabbing'
              : 'sm:cursor-grab'
            : ''
        } ${className}`}
      >
        {children}
      </div>

      {showArrows && isOverflowing && (
        <button
          type="button"
          onClick={() => scrollByStep('right')}
          disabled={!canScrollRight}
          aria-label="រំកិលទៅស្តាំ"
          title="រំកិលទៅស្តាំ"
          className={`hidden sm:flex items-center justify-center w-8 h-10 rounded-xl border shrink-0 transition-all ${
            canScrollRight
              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs active:scale-95'
              : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-default'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

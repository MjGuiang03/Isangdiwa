import { useState, useRef } from 'react';

/**
 * Custom hook to enable slide-down-to-close touch gesture on mobile modals.
 * @param {Function} onClose Callback function triggered when modal is swiped down.
 * @returns {Object} { modalStyle, touchHandlers, DragHandle }
 */
export function useSwipeToClose(onClose) {
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartY = useRef(0);
    const touchStartX = useRef(0);
    const activeDrag = useRef(false);

    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        touchStartY.current = touch.clientY;
        touchStartX.current = touch.clientX;

        const target = e.target;
        // Check if touch target is within a scrolled content area
        const scrollable = target.closest('.svm-modal-body, .dim-body, .user-loan-application-form, .overflow-y-auto');

        if (scrollable && scrollable.scrollTop > 0) {
            activeDrag.current = false;
            return;
        }

        activeDrag.current = true;
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!activeDrag.current) return;
        const touch = e.touches[0];
        const deltaY = touch.clientY - touchStartY.current;
        const deltaX = touch.clientX - touchStartX.current;

        // Only track positive downward swipes where vertical movement dominant
        if (deltaY > 0 && deltaY > Math.abs(deltaX) * 0.7) {
            setTranslateY(deltaY);
        } else if (deltaY < 0) {
            setTranslateY(0);
        }
    };

    const handleTouchEnd = () => {
        if (!activeDrag.current) return;
        activeDrag.current = false;
        setIsDragging(false);

        if (translateY > 75) {
            setTranslateY(500);
            setTimeout(() => {
                if (onClose) onClose();
                setTranslateY(0);
            }, 180);
        } else {
            setTranslateY(0);
        }
    };

    const modalStyle = {
        transform: translateY > 0 ? `translateY(${translateY}px)` : 'translateY(0)',
        transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
    };

    return {
        modalStyle,
        touchHandlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        }
    };
}

/**
 * Visual drag indicator pill handle for mobile bottom sheets.
 */
export function DragHandle() {
    return (
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600/70 mx-auto mt-2 mb-1 shrink-0 sm:hidden cursor-grab active:cursor-grabbing opacity-80" />
    );
}
export default useSwipeToClose;

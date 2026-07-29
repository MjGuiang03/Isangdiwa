import { useState, useRef } from 'react';

/**
 * Hook for swipe-down to dismiss modals on mobile
 * @param {Function} onClose - Callback when modal is swiped down
 * @returns {Object} { containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, dragStyle }
 */
export default function useSwipeDownToClose(onClose) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !touchStartY.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only allow dragging downward
    if (deltaY > 0 && containerRef.current && containerRef.current.scrollTop <= 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 80) {
      if (onClose) onClose();
    }
    setDragY(0);
    touchStartY.current = 0;
  };

  const dragStyle = dragY > 0 ? {
    transform: `translate3d(0, ${dragY}px, 0)`,
    transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  } : {};

  return {
    containerRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    dragStyle,
  };
}

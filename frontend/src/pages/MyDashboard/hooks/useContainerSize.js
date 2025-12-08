/**
 * 컨테이너 크기 측정 훅
 * ResizeObserver를 사용하여 사이드바 변화도 감지
 */

import { useState, useEffect } from 'react';

export const useContainerSize = (containerRef) => {
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();

    // ResizeObserver로 컨테이너 크기 변화 감지 (사이드바 접힘 포함)
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [containerRef]);

  return containerWidth;
};

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Espacements et flags pour adapter l’UI (téléphone / tablette / encoche). */
export function useAppLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const isCompact = width < 360;
    const isTablet = width >= 768;
    const padH = isTablet ? 28 : isCompact ? 14 : 20;
    const padV = isTablet ? 24 : isCompact ? 12 : 18;
    const gap = isTablet ? 16 : 12;
    const fontTitle = isTablet ? 26 : isCompact ? 18 : 22;
    const fontBody = isTablet ? 15 : isCompact ? 13 : 14;
    const maxCardWidth = Math.min(440, width - padH * 2);

    return {
      width,
      height,
      insets,
      isCompact,
      isTablet,
      padH,
      padV,
      gap,
      fontTitle,
      fontBody,
      maxCardWidth,
    };
  }, [width, height, insets]);
}

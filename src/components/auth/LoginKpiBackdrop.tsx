import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function polarJs(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Équivalent RN du `KpiCanvas` du bureau (`LoginPage.tsx`) : grille + panneaux KPI décoratifs animés.
 * Données simulées — ambiance visuelle uniquement (pas d’IPC).
 */
export function LoginKpiBackdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 14_000, easing: Easing.linear }), -1, false);
  }, [t]);

  const pW = Math.min(300, w * 0.78);
  const pH = 118;
  const pX = 12;
  const pY = h * 0.06;
  const innerPad = 12;
  const chartW = pW - innerPad * 2;
  const chartH = pH - 36;
  const cLeft = pX + innerPad;
  const cTop = pY + 28;

  const powerProps = useAnimatedProps(() => {
    const phase = t.value * Math.PI * 2;
    let d = '';
    const n = 56;
    const kMin = 165;
    const kMax = 315;
    for (let i = 0; i < n; i++) {
      const v =
        238 +
        38 * Math.sin(i * 0.11 + phase) +
        14 * Math.sin(i * 0.19 + phase * 0.7);
      const clamped = Math.max(kMin, Math.min(kMax, v));
      const x = cLeft + (i / (n - 1)) * chartW;
      const y = cTop + chartH - ((clamped - kMin) / (kMax - kMin)) * chartH;
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return { d };
  });

  const reactiveProps = useAnimatedProps(() => {
    const phase = t.value * Math.PI * 2 + 0.8;
    let d = '';
    const n = 56;
    const rMin = 35;
    const rMax = 85;
    for (let i = 0; i < n; i++) {
      const v = 58 + 22 * Math.sin(i * 0.09 + phase * 0.85);
      const clamped = Math.max(rMin, Math.min(rMax, v));
      const x = cLeft + (i / (n - 1)) * chartW;
      const y = cTop + chartH - ((clamped - rMin) / (rMax - rMin)) * chartH;
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return { d };
  });

  const fillPathProps = useAnimatedProps(() => {
    const phase = t.value * Math.PI * 2;
    let line = '';
    const n = 56;
    const kMin = 165;
    const kMax = 315;
    for (let i = 0; i < n; i++) {
      const v =
        238 +
        38 * Math.sin(i * 0.11 + phase) +
        14 * Math.sin(i * 0.19 + phase * 0.7);
      const clamped = Math.max(kMin, Math.min(kMax, v));
      const x = cLeft + (i / (n - 1)) * chartW;
      const y = cTop + chartH - ((clamped - kMin) / (kMax - kMin)) * chartH;
      line += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    const x0 = cLeft;
    const x1 = cLeft + chartW;
    const yb = cTop + chartH;
    const d = `${line} L ${x1} ${yb} L ${x0} ${yb} Z`;
    return { d };
  });

  const gaugeW = 152;
  const gaugeH = 164;
  const gX = w - gaugeW - 10;
  const gY = h * 0.05;
  const cx = gX + gaugeW / 2;
  const cy = gY + gaugeH / 2 + 10;
  const R = 48;

  const start135 = polarJs(cx, cy, R, 135);
  const end405 = polarJs(cx, cy, R, 405);
  const trackD = `M ${start135.x} ${start135.y} A ${R} ${R} 0 1 1 ${end405.x} ${end405.y}`;

  const sx = start135.x;
  const sy = start135.y;

  const gaugeValueProps = useAnimatedProps(() => {
    const polarW = (cx0: number, cy0: number, r: number, angleDeg: number) => {
      const rad = (angleDeg * Math.PI) / 180;
      return { x: cx0 + r * Math.cos(rad), y: cy0 + r * Math.sin(rad) };
    };
    const pf = 0.52 + 0.46 * (0.5 + 0.5 * Math.sin(t.value * Math.PI * 2 * 0.35 + 0.2));
    const clampedPf = Math.min(1, Math.max(0.5, pf));
    const endDeg = 135 + 270 * ((clampedPf - 0.5) / 0.5);
    const end = polarW(cx, cy, R, endDeg);
    const sweep = endDeg - 135;
    const largeArc = sweep > 180 ? 1 : 0;
    const d = `M ${sx} ${sy} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
    return { d };
  });

  const harmW = Math.min(268, w * 0.72);
  const harmH = 128;
  const harmX = 12;
  const harmY = Math.max(pY + pH + 16, h - harmH - 24);
  const harmBase = [1, 0.24, 0.13, 0.08, 0.05, 0.032, 0.02];
  const barColors = [
    'rgba(96,165,250,0.9)',
    'rgba(251,191,36,0.9)',
    'rgba(248,113,113,0.9)',
    'rgba(167,139,250,0.9)',
    'rgba(34,211,238,0.9)',
    'rgba(52,211,153,0.9)',
    'rgba(196,181,253,0.9)',
  ];
  const harmLabels = ['H1', 'H3', 'H5', 'H7', 'H9', 'H11', 'H13'];

  return (
    <View style={[styles.wrap, { opacity: 0.94 }]} pointerEvents="none">
      <Svg width={w} height={h}>
        <Defs>
          <Pattern id="loginGrid" width={48} height={48} patternUnits="userSpaceOnUse">
            <Line x1={0} y1={0} x2={0} y2={48} stroke="rgba(99,149,255,0.08)" strokeWidth={1} />
            <Line x1={0} y1={0} x2={48} y2={0} stroke="rgba(99,149,255,0.08)" strokeWidth={1} />
          </Pattern>
          <SvgLinearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="rgba(96,165,250,0.32)" />
            <Stop offset="1" stopColor="rgba(96,165,250,0.02)" />
          </SvgLinearGradient>
          <SvgLinearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="rgba(251,146,60,0.95)" />
            <Stop offset="0.45" stopColor="rgba(52,211,153,0.95)" />
            <Stop offset="1" stopColor="rgba(96,165,250,0.95)" />
          </SvgLinearGradient>
        </Defs>

        <Rect width={w} height={h} fill="url(#loginGrid)" />

        <Rect
          x={pX}
          y={pY}
          width={pW}
          height={pH}
          rx={14}
          fill="rgba(15,23,42,0.58)"
          stroke="rgba(99,149,255,0.28)"
          strokeWidth={1.2}
        />
        <SvgText x={pX + 12} y={pY + 20} fill="rgba(96,165,250,0.95)" fontSize={10} fontWeight="600">
          Puissance Active
        </SvgText>
        <AnimatedPath animatedProps={fillPathProps} fill="url(#areaBlue)" stroke="none" />
        <AnimatedPath
          animatedProps={reactiveProps}
          fill="none"
          stroke="rgba(34,211,238,0.45)"
          strokeWidth={1.4}
        />
        <AnimatedPath
          animatedProps={powerProps}
          fill="none"
          stroke="rgba(96,165,250,0.92)"
          strokeWidth={2}
        />

        <Rect
          x={gX}
          y={gY}
          width={gaugeW}
          height={gaugeH}
          rx={14}
          fill="rgba(15,23,42,0.58)"
          stroke="rgba(99,149,255,0.28)"
          strokeWidth={1.2}
        />
        <SvgText x={gX + 12} y={gY + 20} fill="rgba(167,139,250,0.95)" fontSize={9} fontWeight="600">
          Facteur de Puissance
        </SvgText>
        <Path
          d={trackD}
          fill="none"
          stroke="rgba(148,163,184,0.22)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={gaugeValueProps}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={10}
          strokeLinecap="round"
        />

        <Rect
          x={harmX}
          y={harmY}
          width={harmW}
          height={harmH}
          rx={14}
          fill="rgba(15,23,42,0.58)"
          stroke="rgba(99,149,255,0.28)"
          strokeWidth={1.2}
        />
        <SvgText x={harmX + 12} y={harmY + 20} fill="rgba(167,139,250,0.95)" fontSize={10} fontWeight="600">
          Spectre Harmonique
        </SvgText>
        {harmBase.map((amp, i) => {
          const bx = harmX + 14;
          const by = harmY + 34;
          const bw = harmW - 28;
          const bh = harmH - 48;
          const barW = (bw - 6) / 7;
          const gap = 4;
          const barHeight = amp * bh * 0.92;
          const bBarX = bx + i * barW + gap / 2;
          const bBarY = by + bh - barHeight;
          return (
            <G key={harmLabels[i]}>
              <Rect
                x={bBarX}
                y={bBarY}
                width={barW - gap}
                height={barHeight}
                rx={3}
                fill={barColors[i] ?? 'rgba(96,165,250,0.8)'}
                opacity={0.92}
              />
              <SvgText
                x={bBarX + (barW - gap) / 2 - 6}
                y={by + bh + 12}
                fill="rgba(148,163,184,0.85)"
                fontSize={7}
                fontWeight="500"
              >
                {harmLabels[i]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
  },
});

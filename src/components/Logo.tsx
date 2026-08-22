import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// Same team-of-three mark used on the web admin site — kept in sync by hand since it's drawn
// directly in both places rather than shared as an asset.
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bg" x1="10" y1="6" x2="90" y2="94" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3b82f6" />
          <Stop offset="1" stopColor="#1d4ed8" />
        </LinearGradient>
      </Defs>
      <Rect x={4} y={4} width={92} height={92} rx={22} fill="url(#bg)" />

      <Circle cx={26} cy={43} r={7.5} fill="#ffffff" opacity={0.55} />
      <Rect x={15} y={52} width={22} height={22} rx={11} fill="#ffffff" opacity={0.55} />
      <Circle cx={74} cy={43} r={7.5} fill="#ffffff" opacity={0.55} />
      <Rect x={63} y={52} width={22} height={22} rx={11} fill="#ffffff" opacity={0.55} />

      <Circle cx={50} cy={38} r={9.5} fill="#ffffff" />
      <Rect x={35} y={49} width={30} height={27} rx={15} fill="#ffffff" />
    </Svg>
  );
}

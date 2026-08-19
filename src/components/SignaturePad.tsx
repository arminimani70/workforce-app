import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

// A hand-drawn signature pad. Strokes are kept as SVG path "d" strings (not rasterized to an
// image) so both capture here and review on Checklist Submissions render with the same
// react-native-svg component — no extra native dependency for image export. onChange fires with
// every completed stroke's "d" joined into one combined string; an empty pad reports ''.
export function SignaturePad({
  onChange,
  height = 180,
}: {
  onChange: (svgPath: string) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const pathsRef = useRef<string[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => `${prev} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setCurrentPath((prev) => {
          if (!prev) return prev;
          const next = [...pathsRef.current, prev];
          pathsRef.current = next;
          setPaths(next);
          onChange(next.join(' '));
          return '';
        });
      },
    }),
  ).current;

  const clear = () => {
    pathsRef.current = [];
    setPaths([]);
    setCurrentPath('');
    onChange('');
  };

  const isEmpty = paths.length === 0 && !currentPath;

  return (
    <View>
      <View
        style={[styles.pad, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {isEmpty && <Text style={styles.placeholder}>Sign here</Text>}
        {width > 0 && (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {paths.map((d, index) => (
              <Path key={index} d={d} stroke={colors.text} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {currentPath && (
              <Path d={currentPath} stroke={colors.text} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </Svg>
        )}
      </View>
      <Pressable style={styles.clearButton} onPress={clear}>
        <Text style={styles.clearButtonText}>Clear</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.textFaint,
    fontStyle: 'italic',
  },
  clearButton: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  clearButtonText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});

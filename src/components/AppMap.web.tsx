import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Web stand-in for AppMap.tsx (real react-native-maps) — react-native-maps has no web support
// (it imports native-only RN internals), so bundling it for web crashes the whole app even on
// screens that don't render a map. This mirrors just the prop/ref shape our screens use, as a
// static placeholder, so web stays usable while maps remain fully functional on iOS/Android.

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapPressEvent {
  nativeEvent: { coordinate: LatLng };
}

interface AppMapViewHandle {
  animateToRegion: (region: Region, duration?: number) => void;
}

interface AppMapViewProps {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  onPress?: (event: MapPressEvent) => void;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
}

export const AppMapView = forwardRef<AppMapViewHandle, AppMapViewProps>(function AppMapView(
  { style },
  ref,
) {
  useImperativeHandle(ref, () => ({ animateToRegion: () => {} }));
  return (
    <View style={[styles.placeholder, style]}>
      <Ionicons name="map-outline" size={28} color={colors.textFaint} />
      <Text style={styles.text}>Map preview isn't available on web — use the mobile app</Text>
    </View>
  );
});

export function AppMapCircle() {
  return null;
}

export function AppMapMarker() {
  return null;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 16,
  },
  text: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
});

// Native (iOS/Android) implementation — the real react-native-maps. Metro picks AppMap.web.tsx
// instead when bundling for web, since react-native-maps imports native-only RN internals that
// don't exist there. Every screen should import MapView/Circle/Marker from this module (not
// react-native-maps directly) so it keeps working when bundled for web.
export {
  default as AppMapView,
  Circle as AppMapCircle,
  Marker as AppMapMarker,
} from 'react-native-maps';
export type { LatLng, MapPressEvent, Region } from 'react-native-maps';

import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

// Renders the already-downloaded local file (see OnboardingScreen's onOpenResource) inline —
// a PDF or image opens as a real training document instead of handing off to the OS share
// sheet, which on Android just lists apps with no preview and can silently do nothing if the
// device has none installed. Word/Excel/PowerPoint can't be rendered by a WebView, so those
// still fall back to "open with another app".
export default function DocumentViewerScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'DocumentViewer'>>();
  const { uri, mimeType } = route.params;
  const [isLoading, setIsLoading] = useState(true);

  if (mimeType.startsWith('image/')) {
    return (
      <View style={styles.container}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </View>
    );
  }

  if (mimeType === 'application/pdf') {
    return (
      <View style={styles.container}>
        <WebView
          source={{ uri }}
          style={styles.webview}
          allowingReadAccessToURL={uri}
          onLoadEnd={() => setIsLoading(false)}
        />
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.fallbackContainer}>
      <Ionicons name="document-attach-outline" size={48} color={colors.textFaint} />
      <Text style={styles.fallbackText}>
        This file type can't be previewed here — open it with another app instead.
      </Text>
      <Pressable
        style={styles.fallbackButton}
        onPress={() => Sharing.shareAsync(uri, { mimeType })}
      >
        <Ionicons name="open-outline" size={18} color="#fff" />
        <Text style={styles.fallbackButtonText}>Open with another app</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#fff' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: colors.background,
  },
  fallbackText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  fallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  fallbackButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

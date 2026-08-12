import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../auth/AuthContext';
import { HttpError, timeClockApi } from '../api/client';
import type { TimeClockEntry } from '../types/api';

// Best-effort GPS: if permission is denied or location fails, clock in/out still proceeds
// without a location, matching the backend's optional lat/lng.
async function getLocation(): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return undefined;
    }
    const position = await Location.getCurrentPositionAsync({});
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return undefined;
  }
}

export default function TimeClockScreen() {
  const { authFetch } = useAuth();
  const [openEntry, setOpenEntry] = useState<TimeClockEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const entry = await authFetch((token) => timeClockApi.status(token));
      setOpenEntry(entry);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load status');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onPress = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const location = await getLocation();
      const entry = openEntry
        ? await authFetch((token) => timeClockApi.clockOut(token, location))
        : await authFetch((token) => timeClockApi.clockIn(token, location));
      setOpenEntry(entry.clockOutTime ? null : entry);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{openEntry ? 'Clocked in' : 'Not clocked in'}</Text>
      {openEntry && (
        <Text style={styles.subtitle}>
          Since {new Date(openEntry.clockInTime).toLocaleTimeString()}
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[
          styles.button,
          openEntry ? styles.buttonClockOut : styles.buttonClockIn,
          isSubmitting && styles.buttonDisabled,
        ]}
        onPress={onPress}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{openEntry ? 'Clock Out' : 'Clock In'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  status: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  error: { color: '#c0392b', marginBottom: 12 },
  button: {
    borderRadius: 999,
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonClockIn: { backgroundColor: '#16a34a' },
  buttonClockOut: { backgroundColor: '#dc2626' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

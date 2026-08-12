import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { HttpError, timeClockApi } from '../api/client';
import type { TimeClockEntry } from '../types/api';
import { currentWeekRange, formatElapsed, formatHoursMinutes, monthToDateRange, todayRange } from '../utils/time';
import { cardShadow, colors } from '../theme/colors';

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

type RangeKey = 'today' | 'week' | 'month' | 'all';

const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

function rangeFor(key: RangeKey) {
  switch (key) {
    case 'today':
      return todayRange();
    case 'week':
      return currentWeekRange();
    case 'month':
      return monthToDateRange();
    case 'all':
      return undefined;
  }
}

export default function TimeClockScreen() {
  const { authFetch } = useAuth();
  const [openEntry, setOpenEntry] = useState<TimeClockEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rangeKey, setRangeKey] = useState<RangeKey>('week');
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);

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

  const loadTotal = useCallback(async () => {
    try {
      const result = await authFetch((token) => timeClockApi.total(token, rangeFor(rangeKey)));
      setTotalSeconds(result.totalSeconds);
    } catch {
      setTotalSeconds(null);
    }
  }, [authFetch, rangeKey]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadTotal();
  }, [loadTotal]);

  // Tick every second while clocked in, so the elapsed-time display stays live.
  useEffect(() => {
    if (!openEntry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  const onPress = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const location = await getLocation();
      const entry = openEntry
        ? await authFetch((token) => timeClockApi.clockOut(token, location))
        : await authFetch((token) => timeClockApi.clockIn(token, location));
      setOpenEntry(entry.clockOutTime ? null : entry);
      await loadTotal();
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

  const elapsedMs = openEntry ? now - new Date(openEntry.clockInTime).getTime() : 0;

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Ionicons
          name={openEntry ? 'radio-button-on' : 'radio-button-off-outline'}
          size={16}
          color={openEntry ? colors.success : colors.textFaint}
        />
        <Text style={styles.status}>{openEntry ? 'Clocked in' : 'Not clocked in'}</Text>
      </View>
      {openEntry ? (
        <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
      ) : (
        <View style={styles.timerSpacer} />
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
          <>
            <Ionicons name={openEntry ? 'stop-circle-outline' : 'play-circle-outline'} size={32} color="#fff" />
            <Text style={styles.buttonText}>{openEntry ? 'Clock Out' : 'Clock In'}</Text>
          </>
        )}
      </Pressable>

      <View style={styles.totalsBox}>
        <View style={styles.rangeRow}>
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <Pressable
              key={key}
              style={[styles.rangeButton, rangeKey === key && styles.rangeButtonActive]}
              onPress={() => setRangeKey(key)}
            >
              <Text style={[styles.rangeText, rangeKey === key && styles.rangeTextActive]}>
                {RANGE_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.totalRow}>
          <Ionicons name="time-outline" size={20} color={colors.textMuted} />
          <Text style={styles.totalValue}>
            {totalSeconds === null ? '—' : formatHoursMinutes(totalSeconds)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    gap: 8,
    paddingTop: 48,
    backgroundColor: colors.background,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { fontSize: 22, fontWeight: '700', color: colors.text },
  timer: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.text,
    marginBottom: 24,
  },
  timerSpacer: { height: 40 + 24 },
  error: { color: colors.danger, marginBottom: 12 },
  button: {
    borderRadius: 999,
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...cardShadow,
  },
  buttonClockIn: { backgroundColor: colors.success },
  buttonClockOut: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  totalsBox: {
    marginTop: 40,
    width: '100%',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    ...cardShadow,
  },
  rangeRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    padding: 4,
    width: '100%',
  },
  rangeButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  rangeButtonActive: { backgroundColor: '#fff' },
  rangeText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  rangeTextActive: { color: colors.text },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalValue: { fontSize: 24, fontWeight: '700', color: colors.text },
});

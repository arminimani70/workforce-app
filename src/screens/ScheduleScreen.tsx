import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { HttpError, schedulingApi } from '../api/client';
import type { Shift } from '../types/api';

// Tomorrow 9:00–17:00 local time — a fixed preset so creating a shift needs no date picker
// (there's no Employee Directory yet, so shifts can only be self-assigned for now anyway).
function tomorrowShiftWindow() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

function formatRange(shift: Shift) {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startText = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endText = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startText}–${endText}`;
}

export default function ScheduleScreen() {
  const { user, authFetch } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [jobSite, setJobSite] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canCreate = user?.role === 'owner' || user?.role === 'manager';

  const loadShifts = useCallback(async () => {
    try {
      const result = await authFetch((token) => schedulingApi.myShifts(token));
      setShifts(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load shifts');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const onCreateShift = async () => {
    if (!user) return;
    setError(null);
    setIsCreating(true);
    try {
      const { startTime, endTime } = tomorrowShiftWindow();
      await authFetch((token) =>
        schedulingApi.create(token, {
          employeeId: user._id,
          startTime,
          endTime,
          jobSite: jobSite.trim() || undefined,
        }),
      );
      setJobSite('');
      await loadShifts();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not create shift');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={shifts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={shifts.length === 0 && styles.center}
        ListEmptyComponent={<Text style={styles.empty}>No shifts scheduled yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.shiftRow}>
            <Text style={styles.shiftRange}>{formatRange(item)}</Text>
            <Text style={styles.shiftMeta}>
              {item.jobSite ?? 'No job site set'} · {item.status}
            </Text>
          </View>
        )}
      />

      {canCreate && (
        <View style={styles.createBox}>
          <TextInput
            style={styles.input}
            placeholder="Job site (optional)"
            value={jobSite}
            onChangeText={setJobSite}
          />
          <Pressable
            style={[styles.button, isCreating && styles.buttonDisabled]}
            onPress={onCreateShift}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Schedule tomorrow, 9:00–17:00</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#c0392b', marginBottom: 12 },
  empty: { color: '#666', fontSize: 15 },
  shiftRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  shiftRange: { fontSize: 16, fontWeight: '600' },
  shiftMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  createBox: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

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

// Monday 00:00 to Sunday 23:59:59.999, local time, for the week containing "now".
function currentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { from: monday.toISOString(), to: sunday.toISOString() };
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
  const [isLoading, setIsLoading] = useState(true); // first paint only
  const [isFetching, setIsFetching] = useState(false); // any load, including toggle reloads
  const [isCreating, setIsCreating] = useState(false);
  const [jobSite, setJobSite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [weekOnly, setWeekOnly] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const canCreate = user?.role === 'owner' || user?.role === 'manager';

  const loadShifts = useCallback(async () => {
    setIsFetching(true);
    try {
      const range = weekOnly ? currentWeekRange() : undefined;
      const result = await authFetch((token) => schedulingApi.myShifts(token, range));
      setShifts(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load shifts');
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [authFetch, weekOnly]);

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

  const onConfirmShift = async (shiftId: string) => {
    setError(null);
    setConfirmingId(shiftId);
    try {
      await authFetch((token) => schedulingApi.confirm(token, shiftId));
      await loadShifts();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not confirm shift');
    } finally {
      setConfirmingId(null);
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
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, weekOnly && styles.toggleButtonActive]}
          onPress={() => setWeekOnly(true)}
        >
          <Text style={[styles.toggleText, weekOnly && styles.toggleTextActive]}>This Week</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, !weekOnly && styles.toggleButtonActive]}
          onPress={() => setWeekOnly(false)}
        >
          <Text style={[styles.toggleText, !weekOnly && styles.toggleTextActive]}>
            All Shifts
          </Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {isFetching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={shifts.length === 0 && styles.center}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {weekOnly ? 'No shifts scheduled this week' : 'No shifts scheduled yet'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.shiftRow}>
              <View style={styles.shiftInfo}>
                <Text style={styles.shiftRange}>{formatRange(item)}</Text>
                <Text style={styles.shiftMeta}>
                  {item.jobSite ?? 'No job site set'} · {item.status}
                  {!item.confirmed && ' · pending confirmation'}
                </Text>
              </View>

              {canCreate && !item.confirmed && (
                <Pressable
                  style={styles.confirmButton}
                  onPress={() => onConfirmShift(item._id)}
                  disabled={confirmingId === item._id}
                >
                  {confirmingId === item._id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        />
      )}

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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 14, color: '#666', fontWeight: '600' },
  toggleTextActive: { color: '#111' },
  error: { color: '#c0392b', marginBottom: 12 },
  empty: { color: '#666', fontSize: 15 },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    gap: 12,
  },
  shiftInfo: { flex: 1 },
  shiftRange: { fontSize: 16, fontWeight: '600' },
  shiftMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  confirmButton: {
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  confirmButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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

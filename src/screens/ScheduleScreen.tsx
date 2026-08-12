import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { HttpError, schedulingApi, timeClockApi } from '../api/client';
import type { Shift } from '../types/api';
import { formatHoursMinutes, monthToDateRange } from '../utils/time';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function startOfWeekMonday(date = new Date()) {
  const dayOfWeek = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weekDates(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ScheduleScreen() {
  const { user, authFetch } = useAuth();
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [pendingShifts, setPendingShifts] = useState<Shift[]>([]);
  const [monthTotalSeconds, setMonthTotalSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [jobSite, setJobSite] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const monday = startOfWeekMonday();
  const today = new Date();
  const days = weekDates(monday);
  const weekFrom = monday.toISOString();
  const weekTo = (() => {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday.toISOString();
  })();

  const load = useCallback(async () => {
    try {
      const [week, total] = await Promise.all([
        authFetch((token) => schedulingApi.myShifts(token, { from: weekFrom, to: weekTo })),
        authFetch((token) => timeClockApi.total(token, monthToDateRange())),
      ]);
      setWeekShifts(week.filter((s) => s.confirmed));
      setMonthTotalSeconds(total.totalSeconds);

      if (canManage) {
        const all = await authFetch((token) => schedulingApi.myShifts(token));
        setPendingShifts(all.filter((s) => !s.confirmed));
      }
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load schedule');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, canManage, weekFrom, weekTo]);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
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
      await load();
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && <Text style={styles.error}>{error}</Text>}

      {canManage && pendingShifts.length > 0 && (
        <View style={styles.pendingBox}>
          <Text style={styles.sectionTitle}>Pending confirmation</Text>
          {pendingShifts.map((shift) => (
            <View key={shift._id} style={styles.pendingRow}>
              <Text style={styles.pendingText}>
                {new Date(shift.startTime).toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
              </Text>
              <Pressable
                style={styles.confirmButton}
                onPress={() => onConfirmShift(shift._id)}
                disabled={confirmingId === shift._id}
              >
                {confirmingId === shift._id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.calendar}>
        {days.map((day, index) => {
          const isPast = day < today && !isSameDay(day, today);
          const isToday = isSameDay(day, today);
          const dayShifts = weekShifts.filter((shift) => isSameDay(new Date(shift.startTime), day));

          return (
            <View
              key={index}
              style={[
                styles.dayRow,
                isPast && styles.dayRowPast,
                isToday && styles.dayRowToday,
              ]}
            >
              <View style={styles.dayHeader}>
                <Text style={[styles.dayLabel, isPast && styles.dayTextPast]}>
                  {DAY_LABELS[index]}
                </Text>
                <Text style={[styles.dayDate, isPast && styles.dayTextPast]}>
                  {day.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              <View style={styles.dayShifts}>
                {dayShifts.length === 0 ? (
                  <Text style={[styles.noShift, isPast && styles.dayTextPast]}>—</Text>
                ) : (
                  dayShifts.map((shift) => (
                    <Text key={shift._id} style={[styles.shiftText, isPast && styles.dayTextPast]}>
                      {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                      {shift.jobSite ? ` · ${shift.jobSite}` : ''}
                    </Text>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.monthBox}>
        <Text style={styles.monthLabel}>Worked this month</Text>
        <Text style={styles.monthValue}>
          {monthTotalSeconds === null ? '—' : formatHoursMinutes(monthTotalSeconds)}
        </Text>
      </View>

      {canManage && (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#c0392b' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 8 },
  pendingBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pendingText: { fontSize: 13, color: '#333', flex: 1 },
  confirmButton: {
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  confirmButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  calendar: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, overflow: 'hidden' },
  dayRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  dayRowPast: { backgroundColor: '#f5f5f5' },
  dayRowToday: { backgroundColor: '#eff6ff' },
  dayHeader: { width: 64 },
  dayLabel: { fontSize: 14, fontWeight: '700', color: '#111' },
  dayDate: { fontSize: 12, color: '#666', marginTop: 2 },
  dayTextPast: { color: '#999' },
  dayShifts: { flex: 1, justifyContent: 'center', gap: 2 },
  noShift: { fontSize: 13, color: '#bbb' },
  shiftText: { fontSize: 13, color: '#111', fontWeight: '600' },
  monthBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
  },
  monthLabel: { fontSize: 14, color: '#666' },
  monthValue: { fontSize: 18, fontWeight: '700', color: '#111' },
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

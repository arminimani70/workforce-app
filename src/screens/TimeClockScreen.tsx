import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { HttpError, timeClockApi } from '../api/client';
import type { TimeClockEntry } from '../types/api';
import { formatElapsed, formatHoursMinutes } from '../utils/time';
import { cardShadow, colors } from '../theme/colors';
import { PopupModal } from '../components/PopupModal';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABEL_OPTIONS: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

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

function dayKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

// A Monday-first grid for the given month, padded with nulls so it's always a whole number
// of weeks — the calendar renders those as blank, non-interactive cells.
function monthGrid(year: number, month: number): (Date | null)[] {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0 .. Sun=6
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= totalDays; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function chunkIntoWeeks(cells: (Date | null)[]): (Date | null)[][] {
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function formatRangeLabel(from: Date, to: Date): string {
  if (isSameDay(from, to)) {
    return from.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const fromLabel = from.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const toLabel = to.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fromLabel} – ${toLabel}`;
}

export default function TimeClockScreen() {
  const { authFetch } = useAuth();
  const [openEntry, setOpenEntry] = useState<TimeClockEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);

  // Default is month-to-date.
  const [selectedFrom, setSelectedFrom] = useState(() => {
    const start = new Date();
    start.setDate(1);
    return startOfDay(start);
  });
  const [selectedTo, setSelectedTo] = useState(() => startOfDay(new Date()));

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [pickStart, setPickStart] = useState<Date | null>(null);
  const [pickEnd, setPickEnd] = useState<Date | null>(null);

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
      const result = await authFetch((token) =>
        timeClockApi.total(token, {
          from: selectedFrom.toISOString(),
          to: endOfDay(selectedTo).toISOString(),
        }),
      );
      setTotalSeconds(result.totalSeconds);
    } catch {
      setTotalSeconds(null);
    }
  }, [authFetch, selectedFrom, selectedTo]);

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

  const openCalendar = () => {
    setPickStart(selectedFrom);
    setPickEnd(selectedTo);
    setCalendarMonth(selectedFrom);
    setIsCalendarOpen(true);
  };

  const onSelectDay = (day: Date) => {
    if (!pickStart || pickEnd) {
      setPickStart(day);
      setPickEnd(null);
      return;
    }
    if (dayKey(day) < dayKey(pickStart)) {
      setPickEnd(pickStart);
      setPickStart(day);
    } else {
      setPickEnd(day);
    }
  };

  const onApplyRange = () => {
    if (!pickStart) return;
    setSelectedFrom(startOfDay(pickStart));
    setSelectedTo(startOfDay(pickEnd ?? pickStart));
    setIsCalendarOpen(false);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const elapsedMs = openEntry ? now - new Date(openEntry.clockInTime).getTime() : 0;
  const weeks = chunkIntoWeeks(monthGrid(calendarMonth.getFullYear(), calendarMonth.getMonth()));

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
        <Pressable style={styles.rangePicker} onPress={openCalendar}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.rangePickerText}>{formatRangeLabel(selectedFrom, selectedTo)}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textFaint} />
        </Pressable>

        <View style={styles.totalRow}>
          <Ionicons name="time-outline" size={20} color={colors.textMuted} />
          <Text style={styles.totalValue}>
            {totalSeconds === null ? '—' : formatHoursMinutes(totalSeconds)}
          </Text>
        </View>
      </View>

      <PopupModal visible={isCalendarOpen} onClose={() => setIsCalendarOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select a Date Range</Text>

            <View style={styles.monthNavRow}>
              <Pressable
                style={styles.monthNavButton}
                onPress={() =>
                  setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                }
              >
                <Text style={styles.monthNavButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.monthNavLabel}>
                {calendarMonth.toLocaleDateString([], MONTH_LABEL_OPTIONS)}
              </Text>
              <Pressable
                style={styles.monthNavButton}
                onPress={() =>
                  setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                }
              >
                <Text style={styles.monthNavButtonText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View>
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.calendarWeekRow}>
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return <View key={dayIndex} style={styles.calendarCell} />;
                    }
                    const isStart = pickStart && isSameDay(day, pickStart);
                    const isEnd = pickEnd && isSameDay(day, pickEnd);
                    const inRange =
                      pickStart &&
                      pickEnd &&
                      dayKey(day) >= dayKey(pickStart) &&
                      dayKey(day) <= dayKey(pickEnd);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <Pressable
                        key={dayIndex}
                        style={styles.calendarCell}
                        onPress={() => onSelectDay(day)}
                      >
                        <View
                          style={[
                            styles.dayCircle,
                            !!inRange && styles.dayCircleInRange,
                            (isStart || isEnd) && styles.dayCircleSelected,
                            isToday && !isStart && !isEnd && styles.dayCircleToday,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              !!inRange && styles.dayTextInRange,
                              (isStart || isEnd) && styles.dayTextSelected,
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setIsCalendarOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.applyButton, !pickStart && styles.buttonDisabled]}
                onPress={onApplyRange}
                disabled={!pickStart}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
            </View>
          </View>
      </PopupModal>
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
  rangePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '100%',
  },
  rangePickerText: { fontSize: 14, fontWeight: '600', color: colors.text },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 10,
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavButtonText: { fontSize: 16, fontWeight: '700', color: '#333' },
  monthNavLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaint,
  },
  calendarWeekRow: { flexDirection: 'row' },
  calendarCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: {
    width: '82%',
    height: '82%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleInRange: { backgroundColor: colors.infoBg, borderRadius: 0 },
  dayCircleSelected: { backgroundColor: colors.primary, borderRadius: 999 },
  dayCircleToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { fontSize: 14, color: colors.text },
  dayTextInRange: { color: colors.infoText },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  applyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  applyButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

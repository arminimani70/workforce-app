import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { branchesApi, HttpError, timeClockApi } from '../api/client';
import type { Branch, Position, TimeClockEntry } from '../types/api';
import { POSITIONS } from '../types/api';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import { formatElapsed, formatHoursMinutes, fullDayRange } from '../utils/time';
import { distanceMeters, formatDistance } from '../utils/geo';
import { useTodayShiftContext } from '../hooks/useTodayShiftContext';
import { cardShadow, colors } from '../theme/colors';
import { NoteBox } from '../components/NoteBox';
import { PopupModal } from '../components/PopupModal';
import { BranchTag } from '../components/BranchTag';
import { AppMapCircle, AppMapView } from '../components/AppMap';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Picked in the Extra Shift Clock In popup — a short list of the common reasons someone starts
// work without a shift scheduled, plus a catch-all that reveals a free-text field.
const REASON_PRESETS = ['Extra day', 'Covering a coworker', 'Called in urgently'];
const OTHER_REASON = 'Other';
const MONTH_LABEL_OPTIONS: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
// Shown behind the clock-in circle before a live GPS fix arrives (or if permission is denied).
const FALLBACK_REGION = { latitude: 35.6892, longitude: 51.389 };

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

// The clock-in endpoint needs the caller's local "today" bounds (not the server's) to check for
// a shift scheduled today — fullDayRange() already computes that in the device's timezone for
// other range queries, just under from/to naming instead of dayStart/dayEnd.
function todayBounds() {
  const { from, to } = fullDayRange();
  return { dayStart: from, dayEnd: to };
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
  const insets = useSafeAreaInsets();
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

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isExtraOpen, setIsExtraOpen] = useState(false);
  const [extraBranch, setExtraBranch] = useState<Branch | null>(null);
  const [extraPosition, setExtraPosition] = useState<Position | null>(null);
  const [extraReasonChoice, setExtraReasonChoice] = useState<string | null>(null);
  const [extraReasonOther, setExtraReasonOther] = useState('');
  const [extraError, setExtraError] = useState<string | null>(null);
  const [isExtraSubmitting, setIsExtraSubmitting] = useState(false);

  // Live GPS for the map behind the clock-in circle — separate from getLocation() above, which
  // takes a one-off fix at the moment of the actual clock-in/out submission.
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { branch: todayBranch, position: todayPosition } = useTodayShiftContext();
  const mapRef = useRef<AppMapView>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
          (position) => {
            const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
            setMyLocation(coords);
            mapRef.current?.animateToRegion({
              latitude: coords.lat,
              longitude: coords.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          },
        );
      } catch {
        // No live map centering if GPS fails — the map still shows the fallback region.
      }
    })();
    return () => subscription?.remove();
  }, []);

  // Only needed for the Extra Shift Clock In popup's branch picker — loaded once, not tied to
  // any particular shift.
  useEffect(() => {
    authFetch((token) => branchesApi.list(token))
      .then(setBranches)
      .catch(() => {});
  }, [authFetch]);

  const distanceToBranch =
    todayBranch && myLocation
      ? distanceMeters(myLocation, { lat: todayBranch.lat, lng: todayBranch.lng })
      : null;
  const isFarFromBranch =
    distanceToBranch !== null && todayBranch !== null && distanceToBranch > todayBranch.radiusMeters;

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
        : await authFetch((token) => timeClockApi.clockIn(token, location, todayBounds()));
      setOpenEntry(entry.clockOutTime ? null : entry);
      await loadTotal();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openExtra = () => {
    setExtraBranch(null);
    setExtraPosition(null);
    setExtraReasonChoice(null);
    setExtraReasonOther('');
    setExtraError(null);
    setIsExtraOpen(true);
  };

  // A shift-less clock-in: the person needs to start work today with nothing scheduled (covering
  // a coworker, called in urgently, an extra day, etc). The backend normally rejects a clock-in
  // with no approved shift that day — sending a reason (plus the branch/position, since there's
  // no shift to infer them from) is what makes it accept one anyway.
  const onSubmitExtra = async () => {
    if (!extraBranch) {
      setExtraError('Select a branch');
      return;
    }
    if (!extraPosition) {
      setExtraError('Select a position');
      return;
    }
    if (!extraReasonChoice) {
      setExtraError('Select a reason');
      return;
    }
    const reason =
      extraReasonChoice === OTHER_REASON ? extraReasonOther.trim() : extraReasonChoice;
    if (!reason) {
      setExtraError('Enter a reason');
      return;
    }

    setExtraError(null);
    setIsExtraSubmitting(true);
    try {
      const location = await getLocation();
      const entry = await authFetch((token) =>
        timeClockApi.clockIn(token, location, {
          ...todayBounds(),
          reason,
          jobSite: extraBranch.name,
          position: extraPosition,
        }),
      );
      setOpenEntry(entry.clockOutTime ? null : entry);
      await loadTotal();
      setIsExtraOpen(false);
    } catch (err) {
      setExtraError(err instanceof HttpError ? err.message : 'Something went wrong');
    } finally {
      setIsExtraSubmitting(false);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const elapsedMs = openEntry ? now - new Date(openEntry.clockInTime).getTime() : 0;
  // "Today's shift" (branch/position, and the "starts soon"/"started at" framing) is now the
  // primary event on Home instead of living here — this just keeps a light branch/position
  // hint under the timer for in-the-moment context while this screen is open.
  const shiftContextLabel = [todayBranch?.name, todayPosition ? POSITION_LABELS[todayPosition] : null]
    .filter(Boolean)
    .join(' · ');
  const weeks = chunkIntoWeeks(monthGrid(calendarMonth.getFullYear(), calendarMonth.getMonth()));

  return (
    <View style={styles.container}>
      <AppMapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: myLocation?.lat ?? todayBranch?.lat ?? FALLBACK_REGION.latitude,
          longitude: myLocation?.lng ?? todayBranch?.lng ?? FALLBACK_REGION.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
      >
        {todayBranch && (
          <AppMapCircle
            center={{ latitude: todayBranch.lat, longitude: todayBranch.lng }}
            radius={todayBranch.radiusMeters}
            strokeColor={colors.primary}
            fillColor="rgba(37,99,235,0.15)"
          />
        )}
      </AppMapView>

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.statusRow}>
          <Ionicons
            name={openEntry ? 'radio-button-on' : 'radio-button-off-outline'}
            size={16}
            color={openEntry ? colors.success : colors.textFaint}
          />
          <Text style={styles.status}>{openEntry ? 'Clocked in' : 'Not clocked in'}</Text>
        </View>

        {openEntry ? (
          <View style={styles.timerBlock}>
            <Text style={styles.timer}>{formatElapsed(elapsedMs)}</Text>
            {shiftContextLabel && (
              todayBranch ? (
                <View style={styles.shiftContextTag}>
                  <BranchTag jobSite={todayBranch.name} label={shiftContextLabel} />
                </View>
              ) : (
                <Text style={styles.shiftContext}>{shiftContextLabel}</Text>
              )
            )}
          </View>
        ) : (
          <View style={styles.timerSpacer} />
        )}

        {error && <NoteBox variant="danger">{error}</NoteBox>}

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

        {isFarFromBranch && todayBranch && (
          <NoteBox variant="danger">
            You're outside {todayBranch.name}'s allowed radius by about{' '}
            {formatDistance(distanceToBranch! - todayBranch.radiusMeters)} — get closer before
            clocking in, or it will be rejected.
          </NoteBox>
        )}

        {!openEntry && (
          <Pressable style={styles.extraButton} onPress={openExtra}>
            <Ionicons name="people-outline" size={16} color="#fff" />
            <Text style={styles.extraButtonText}>Extra Shift Clock In</Text>
          </Pressable>
        )}

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

      <PopupModal visible={isExtraOpen} onClose={() => setIsExtraOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Extra Shift Clock In</Text>
            <Text style={styles.extraHint}>
              No shift scheduled today — pick where you're working and why, and you'll be
              clocked in.
            </Text>

            <Text style={styles.sectionLabel}>Branch</Text>
            {branches.length === 0 ? (
              <Text style={styles.noOptionsText}>No branches set up yet</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {branches.map((branch) => {
                  const isActive = extraBranch?._id === branch._id;
                  return (
                    <Pressable
                      key={branch._id}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => setExtraBranch(branch)}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {branch.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={styles.sectionLabel}>Position</Text>
            <View style={styles.chipsWrap}>
              {POSITIONS.map((position) => {
                const isActive = extraPosition === position;
                return (
                  <Pressable
                    key={position}
                    style={[
                      styles.chip,
                      isActive && {
                        backgroundColor: POSITION_COLORS[position],
                        borderColor: POSITION_COLORS[position],
                      },
                    ]}
                    onPress={() => setExtraPosition(position)}
                  >
                    <Ionicons
                      name={POSITION_ICONS[position]}
                      size={14}
                      color={isActive ? '#fff' : POSITION_COLORS[position]}
                    />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {POSITION_LABELS[position]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Reason</Text>
            <View style={styles.chipsWrap}>
              {[...REASON_PRESETS, OTHER_REASON].map((option) => {
                const isActive = extraReasonChoice === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setExtraReasonChoice(option)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {extraReasonChoice === OTHER_REASON && (
              <TextInput
                style={styles.extraInput}
                placeholder="Describe the reason"
                value={extraReasonOther}
                onChangeText={setExtraReasonOther}
                multiline
                numberOfLines={2}
              />
            )}

            {extraError && <NoteBox variant="danger">{extraError}</NoteBox>}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setIsExtraOpen(false)}
                disabled={isExtraSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.applyButton, isExtraSubmitting && styles.buttonDisabled]}
                onPress={onSubmitExtra}
                disabled={isExtraSubmitting}
              >
                {isExtraSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.applyButtonText}>Clock In</Text>
                )}
              </Pressable>
            </View>
          </View>
      </PopupModal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  // The map fills the whole screen as a live background; `content` floats on top of it with a
  // transparent background so the map shows through everywhere except elements that paint
  // their own (the translucent clock-in circle, the solid totals card).
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    gap: 8,
    paddingTop: 48,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { fontSize: 22, fontWeight: '700', color: colors.text },
  timerBlock: { alignItems: 'center', marginBottom: 24 },
  timer: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  shiftContext: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  shiftContextTag: { marginTop: 6 },
  timerSpacer: { height: 40 + 24 },
  // A translucent circle so the live map underneath still shows through it.
  button: {
    borderRadius: 999,
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...cardShadow,
  },
  buttonClockIn: { backgroundColor: 'rgba(22,163,74,0.8)' },
  buttonClockOut: { backgroundColor: 'rgba(220,38,38,0.8)' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  extraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.teal,
    ...cardShadow,
  },
  extraButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  extraHint: { fontSize: 13, color: colors.textMuted },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  noOptionsText: { fontSize: 13, color: colors.textFaint },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff' },
  extraInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
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

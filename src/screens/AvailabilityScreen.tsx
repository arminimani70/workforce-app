import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { availabilityApi, HttpError } from '../api/client';
import { POSITIONS } from '../types/api';
import type { AvailabilityEntry, AvailabilityStatus, Position } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_ICONS: Record<AvailabilityStatus, IconName> = {
  unavailable: 'close-circle-outline',
  available: 'checkmark-circle-outline',
  flexible: 'swap-horizontal-outline',
};

const STATUS_ICON_COLORS: Record<AvailabilityStatus, string> = {
  unavailable: colors.textFaint,
  available: colors.success,
  flexible: colors.purple,
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfWeekMonday(date = new Date()) {
  const dayOfWeek = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addWeeks(date: Date, weeks: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
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

function summarize(entry: AvailabilityEntry | undefined): string {
  if (!entry) return 'Not set';
  if (entry.status === 'unavailable') return 'Unavailable';
  if (entry.status === 'flexible') return 'Flexible — manager decides';
  const time = entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime}` : 'No time set';
  const positions = entry.positions?.length
    ? entry.positions.map((p) => POSITION_LABELS[p]).join(', ')
    : 'No position set';
  return `${time} · ${positions}`;
}

export default function AvailabilityScreen() {
  const { authFetch } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [formStatus, setFormStatus] = useState<AvailabilityStatus>('unavailable');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formPositions, setFormPositions] = useState<Position[]>([]);

  const today = new Date();
  const monday = addWeeks(startOfWeekMonday(), weekOffset);
  const days = weekDates(monday);
  const sunday = days[6];
  const weekFrom = monday.toISOString();
  const weekTo = (() => {
    const d = new Date(sunday);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();
  const isCurrentWeek = weekOffset === 0;
  const weekLabel = `${monday.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  const load = useCallback(async () => {
    try {
      const mine = await authFetch((token) =>
        availabilityApi.getMine(token, { from: weekFrom, to: weekTo }),
      );
      setEntries(mine);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load availability');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, weekFrom, weekTo]);

  useEffect(() => {
    load();
  }, [load]);

  const entryForDay = (day: Date) => entries.find((e) => isSameDay(new Date(e.date), day));

  const openDayModal = (day: Date) => {
    const existing = entryForDay(day);
    setFormStatus(existing?.status ?? 'unavailable');
    setFormStartTime(existing?.startTime ?? '09:00');
    setFormEndTime(existing?.endTime ?? '17:00');
    setFormPositions(existing?.positions ?? []);
    setError(null);
    setOpenDay(day);
  };

  const togglePosition = (position: Position) => {
    setFormPositions((prev) =>
      prev.includes(position) ? prev.filter((p) => p !== position) : [...prev, position],
    );
  };

  const onSave = async () => {
    if (!openDay) return;
    setError(null);
    setIsSaving(true);
    try {
      await authFetch((token) =>
        availabilityApi.updateMine(token, {
          date: openDay.toISOString(),
          status: formStatus,
          startTime: formStatus === 'available' ? formStartTime : undefined,
          endTime: formStatus === 'available' ? formEndTime : undefined,
          positions: formStatus === 'available' ? formPositions : undefined,
        }),
      );
      setOpenDay(null);
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save availability');
    } finally {
      setIsSaving(false);
    }
  };

  const onClear = async () => {
    if (!openDay) return;
    setError(null);
    setIsClearing(true);
    try {
      await authFetch((token) => availabilityApi.deleteMine(token, openDay.toISOString()));
      setOpenDay(null);
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not clear availability');
    } finally {
      setIsClearing(false);
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
      <View style={styles.weekNavRow}>
        <Pressable style={styles.weekNavButton} onPress={() => setWeekOffset((w) => w - 1)}>
          <Text style={styles.weekNavButtonText}>‹</Text>
        </Pressable>

        <View style={styles.weekNavTitle}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>{weekLabel}</Text>
          </View>
          {isCurrentWeek ? (
            <View style={styles.currentWeekBadge}>
              <Text style={styles.currentWeekBadgeText}>This Week</Text>
            </View>
          ) : (
            <Pressable onPress={() => setWeekOffset(0)}>
              <Text style={styles.jumpToTodayText}>Jump to this week</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.weekNavButton} onPress={() => setWeekOffset((w) => w + 1)}>
          <Text style={styles.weekNavButtonText}>›</Text>
        </Pressable>
      </View>

      {error && !openDay && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.list}>
        {days.map((day, index) => {
          const entry = entryForDay(day);
          const status = entry?.status ?? null;
          const isPast = day < today && !isSameDay(day, today);
          return (
            <Pressable
              key={index}
              style={[styles.dayRow, isPast && styles.dayRowPast]}
              onPress={() => openDayModal(day)}
            >
              <Ionicons
                name={status ? STATUS_ICONS[status] : 'ellipse-outline'}
                size={22}
                color={status ? STATUS_ICON_COLORS[status] : colors.textFaint}
                style={styles.dayIcon}
              />
              <View style={styles.dayTextGroup}>
                <Text style={styles.dayLabel}>
                  {DAY_LABELS[index]} · {day.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={styles.daySummary}>{summarize(entry)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal
        visible={openDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setOpenDay(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {openDay && (
              <>
                <Text style={styles.modalTitle}>
                  {openDay.toLocaleDateString([], {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>

                <View style={styles.statusRow}>
                  {(['unavailable', 'available', 'flexible'] as AvailabilityStatus[]).map(
                    (status) => (
                      <Pressable
                        key={status}
                        style={[
                          styles.statusButton,
                          formStatus === status && styles.statusButtonActive,
                        ]}
                        onPress={() => setFormStatus(status)}
                      >
                        <Ionicons
                          name={STATUS_ICONS[status]}
                          size={16}
                          color={formStatus === status ? '#fff' : STATUS_ICON_COLORS[status]}
                        />
                        <Text
                          style={[
                            styles.statusButtonText,
                            formStatus === status && styles.statusButtonTextActive,
                          ]}
                        >
                          {status === 'unavailable'
                            ? 'Unavailable'
                            : status === 'available'
                              ? 'Available'
                              : 'Flexible'}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>

                {formStatus === 'available' && (
                  <>
                    <View style={styles.timeRow}>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="09:00"
                        value={formStartTime}
                        onChangeText={setFormStartTime}
                      />
                      <Text style={styles.timeSeparator}>–</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="17:00"
                        value={formEndTime}
                        onChangeText={setFormEndTime}
                      />
                    </View>

                    <Text style={styles.sectionLabel}>Positions</Text>
                    <View style={styles.positionsWrap}>
                      {POSITIONS.map((position) => {
                        const selected = formPositions.includes(position);
                        return (
                          <Pressable
                            key={position}
                            style={[
                              styles.positionChip,
                              selected && {
                                backgroundColor: POSITION_COLORS[position],
                                borderColor: POSITION_COLORS[position],
                              },
                            ]}
                            onPress={() => togglePosition(position)}
                          >
                            <Ionicons
                              name={POSITION_ICONS[position]}
                              size={14}
                              color={selected ? '#fff' : POSITION_COLORS[position]}
                            />
                            <Text
                              style={[
                                styles.positionChipText,
                                selected && styles.positionChipTextActive,
                              ]}
                            >
                              {POSITION_LABELS[position]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  style={[styles.doneButton, isSaving && styles.buttonDisabled]}
                  onPress={onSave}
                  disabled={isSaving || isClearing}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.doneButtonText}>Save</Text>
                    </>
                  )}
                </Pressable>

                <View style={styles.secondaryRow}>
                  {entryForDay(openDay) && (
                    <Pressable
                      style={styles.clearButton}
                      onPress={onClear}
                      disabled={isSaving || isClearing}
                    >
                      {isClearing ? (
                        <ActivityIndicator color={colors.danger} size="small" />
                      ) : (
                        <Text style={styles.clearButtonText}>Clear</Text>
                      )}
                    </Pressable>
                  )}
                  <Pressable style={styles.cancelButton} onPress={() => setOpenDay(null)}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  weekNavTitle: { flex: 1, alignItems: 'center', gap: 2 },
  weekNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  weekNavButtonText: { fontSize: 18, fontWeight: '700', color: colors.text },
  currentWeekBadge: {
    backgroundColor: colors.infoBg,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  currentWeekBadgeText: { fontSize: 11, fontWeight: '700', color: colors.infoText },
  jumpToTodayText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  error: { color: colors.danger, marginBottom: 8 },
  list: { gap: 8, paddingBottom: 16 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    ...cardShadow,
  },
  dayRowPast: { opacity: 0.6 },
  dayIcon: { width: 22 },
  dayTextGroup: { flex: 1 },
  dayLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  daySummary: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4, color: colors.text },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
  },
  statusButtonActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  statusButtonText: { fontSize: 13, fontWeight: '600', color: colors.text },
  statusButtonTextActive: { color: '#fff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    textAlign: 'center',
  },
  timeSeparator: { fontSize: 15, color: colors.textMuted },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 8 },
  positionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  positionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  positionChipText: { fontSize: 13, color: '#333' },
  positionChipTextActive: { color: '#fff' },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.text,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  doneButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  clearButton: { padding: 8 },
  clearButtonText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  cancelButton: { padding: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 14 },
});

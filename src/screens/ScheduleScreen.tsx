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
import { useAuth } from '../auth/AuthContext';
import { HttpError, schedulingApi, timeClockApi, usersApi } from '../api/client';
import { POSITIONS } from '../types/api';
import type { CoworkerShift, OrgMember, Position, Shift } from '../types/api';
import { formatHoursMinutes, monthToDateRange, todayRange } from '../utils/time';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const POSITION_LABELS: Record<Position, string> = {
  frontdesk: 'Front Desk',
  helpdesk: 'Help Desk',
  information: 'Information',
  consultation: 'Consultation',
};

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Combines a calendar day with an "HH:mm" string into a full local Date.
function combineDateAndTime(date: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

export default function ScheduleScreen() {
  const { user, authFetch } = useAuth();
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [pendingShifts, setPendingShifts] = useState<Shift[]>([]);
  const [todayCoworkers, setTodayCoworkers] = useState<CoworkerShift[]>([]);
  const [monthTotalSeconds, setMonthTotalSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [jobSite, setJobSite] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalWeekOffset, setModalWeekOffset] = useState(0);
  const [modalSelectedDate, setModalSelectedDate] = useState<Date | null>(null);
  const [modalStartTime, setModalStartTime] = useState('09:00');
  const [modalEndTime, setModalEndTime] = useState('17:00');

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

  const modalWeekMonday = addWeeks(monday, modalWeekOffset);
  const modalWeekDays = weekDates(modalWeekMonday);
  const modalWeekSunday = (() => {
    const sunday = new Date(modalWeekMonday);
    sunday.setDate(modalWeekMonday.getDate() + 6);
    return sunday;
  })();
  const modalWeekLabel = `${modalWeekMonday.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${modalWeekSunday.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  const load = useCallback(async () => {
    try {
      const [week, total, coworkers] = await Promise.all([
        authFetch((token) => schedulingApi.myShifts(token, { from: weekFrom, to: weekTo })),
        authFetch((token) => timeClockApi.total(token, monthToDateRange())),
        authFetch((token) => schedulingApi.coworkers(token, todayRange())),
      ]);
      setWeekShifts(week.filter((s) => s.approval === 'approved'));
      setMonthTotalSeconds(total.totalSeconds);
      setTodayCoworkers(coworkers);

      if (canManage) {
        // Org-wide, not myShifts: a manager needs to confirm shifts they created for anyone,
        // not just ones where they themselves are the assigned employee.
        const [all, orgMembers] = await Promise.all([
          authFetch((token) => schedulingApi.all(token)),
          authFetch((token) => usersApi.list(token)),
        ]);
        setPendingShifts(all.filter((s) => s.approval === 'pending'));
        setMembers(orgMembers);
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
    if (!selectedEmployeeId) {
      setError('Pick who this shift is for');
      return;
    }
    if (!modalSelectedDate) {
      setError('Pick a day');
      return;
    }
    if (!TIME_PATTERN.test(modalStartTime) || !TIME_PATTERN.test(modalEndTime)) {
      setError('Start/end time must be HH:mm');
      return;
    }

    const startTime = combineDateAndTime(modalSelectedDate, modalStartTime);
    const endTime = combineDateAndTime(modalSelectedDate, modalEndTime);
    if (endTime <= startTime) {
      setError('End time must be after start time');
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      await authFetch((token) =>
        schedulingApi.create(token, {
          employeeId: selectedEmployeeId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          jobSite: jobSite.trim() || undefined,
          position: selectedPosition ?? undefined,
        }),
      );
      setJobSite('');
      setSelectedPosition(null);
      setSelectedEmployeeId(null);
      setModalSelectedDate(null);
      setIsModalOpen(false);
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

  const onRejectShift = async (shiftId: string) => {
    setError(null);
    setRejectingId(shiftId);
    try {
      await authFetch((token) => schedulingApi.reject(token, shiftId));
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not reject shift');
    } finally {
      setRejectingId(null);
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
                {members.find((m) => m._id === shift.employeeId)?.fullName ?? 'Unknown'} ·{' '}
                {new Date(shift.startTime).toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
              </Text>
              <View style={styles.pendingActions}>
                <Pressable
                  style={styles.confirmButton}
                  onPress={() => onConfirmShift(shift._id)}
                  disabled={confirmingId === shift._id || rejectingId === shift._id}
                >
                  {confirmingId === shift._id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.rejectButton}
                  onPress={() => onRejectShift(shift._id)}
                  disabled={confirmingId === shift._id || rejectingId === shift._id}
                >
                  {rejectingId === shift._id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  )}
                </Pressable>
              </View>
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

      <View style={styles.coworkersBox}>
        <Text style={styles.sectionTitleDark}>Working Today</Text>
        {todayCoworkers.length === 0 ? (
          <Text style={styles.noShift}>No one scheduled today</Text>
        ) : (
          todayCoworkers.map((shift) => (
            <View key={shift._id} style={styles.coworkerRow}>
              <Text style={styles.coworkerName}>
                {shift.employeeId._id === user?._id ? 'You' : shift.employeeId.fullName}
              </Text>
              <Text style={styles.coworkerMeta}>
                {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                {shift.position ? ` · ${POSITION_LABELS[shift.position]}` : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.monthBox}>
        <Text style={styles.monthLabel}>Worked this month</Text>
        <Text style={styles.monthValue}>
          {monthTotalSeconds === null ? '—' : formatHoursMinutes(monthTotalSeconds)}
        </Text>
      </View>

      {canManage && (
        <Pressable style={styles.newShiftButton} onPress={() => setIsModalOpen(true)}>
          <Text style={styles.newShiftButtonText}>+ New Shift</Text>
        </Pressable>
      )}

      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ gap: 12 }}>
            <Text style={styles.formTitle}>New Shift</Text>

            <Text style={styles.sectionLabel}>Week</Text>
            <View style={styles.weekNavRow}>
              <Pressable
                style={styles.weekNavButton}
                onPress={() => setModalWeekOffset((w) => w - 1)}
              >
                <Text style={styles.weekNavButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.weekNavLabel}>{modalWeekLabel}</Text>
              <Pressable
                style={styles.weekNavButton}
                onPress={() => setModalWeekOffset((w) => w + 1)}
              >
                <Text style={styles.weekNavButtonText}>›</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Day</Text>
            <View style={styles.chipsWrap}>
              {modalWeekDays.map((day, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.chip,
                    modalSelectedDate &&
                      isSameDay(modalSelectedDate, day) &&
                      styles.chipActive,
                  ]}
                  onPress={() => setModalSelectedDate(day)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      modalSelectedDate &&
                        isSameDay(modalSelectedDate, day) &&
                        styles.chipTextActive,
                    ]}
                  >
                    {DAY_LABELS[index]} {day.getDate()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Time</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                placeholder="09:00"
                value={modalStartTime}
                onChangeText={setModalStartTime}
              />
              <Text style={styles.timeSeparator}>–</Text>
              <TextInput
                style={styles.timeInput}
                placeholder="17:00"
                value={modalEndTime}
                onChangeText={setModalEndTime}
              />
            </View>

            <Text style={styles.sectionLabel}>For</Text>
            <View style={styles.chipsWrap}>
              {members.map((member) => (
                <Pressable
                  key={member._id}
                  style={[styles.chip, selectedEmployeeId === member._id && styles.chipActive]}
                  onPress={() => setSelectedEmployeeId(member._id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedEmployeeId === member._id && styles.chipTextActive,
                    ]}
                  >
                    {member.fullName}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Position (optional)</Text>
            <View style={styles.chipsWrap}>
              {POSITIONS.map((position) => (
                <Pressable
                  key={position}
                  style={[styles.chip, selectedPosition === position && styles.chipActive]}
                  onPress={() =>
                    setSelectedPosition(selectedPosition === position ? null : position)
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedPosition === position && styles.chipTextActive,
                    ]}
                  >
                    {POSITION_LABELS[position]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Job site (optional)"
              value={jobSite}
              onChangeText={setJobSite}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, isCreating && styles.buttonDisabled]}
              onPress={onCreateShift}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Shift</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => setIsModalOpen(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
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
  pendingActions: { flexDirection: 'row', gap: 6 },
  confirmButton: {
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  confirmButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rejectButton: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  rejectButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  coworkersBox: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 4 },
  coworkerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  coworkerName: { fontSize: 14, fontWeight: '600', color: '#111' },
  coworkerMeta: { fontSize: 13, color: '#666' },
  newShiftButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  newShiftButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavButtonText: { fontSize: 18, fontWeight: '700', color: '#333' },
  weekNavLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    textAlign: 'center',
  },
  timeSeparator: { fontSize: 15, color: '#666' },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: '#666', fontSize: 14 },
  formTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
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

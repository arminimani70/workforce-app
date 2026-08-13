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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { HttpError, schedulingApi, timeClockApi, usersApi } from '../api/client';
import { POSITIONS } from '../types/api';
import type { CoworkerShift, OrgMember, Position, Shift } from '../types/api';
import { formatHoursMinutes, fullDayRange, monthToDateRange } from '../utils/time';
import { cardShadow, colors } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type ViewScope = 'me' | 'branch' | 'all';

const SCOPE_LABELS: Record<ViewScope, string> = {
  me: 'Me',
  branch: 'My Branch',
  all: 'All Branches',
};

const SCOPE_ICONS: Record<ViewScope, keyof typeof Ionicons.glyphMap> = {
  me: 'person-outline',
  branch: 'business-outline',
  all: 'globe-outline',
};

const POSITION_LABELS: Record<Position, string> = {
  frontdesk: 'Front Desk',
  helpdesk: 'Help Desk',
  information: 'Information',
  consultation: 'Consultation',
  manager: 'Manager',
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

// Names a couple of coworkers and folds the rest into a count, so a branch with 100 people
// doesn't try to cram 100 names into one line — full names are still all in the day-detail
// popup, this is just the calendar row's at-a-glance summary.
const MAX_NAMED_COWORKERS = 2;

function summarizeCoworkers(coworkers: CoworkerShift[]): string {
  const names = coworkers.slice(0, MAX_NAMED_COWORKERS).map((c) => c.employeeId.fullName);
  const remaining = coworkers.length - names.length;
  if (remaining <= 0) return `With ${names.join(', ')}`;
  return `With ${names.join(', ')} +${remaining} more`;
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
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [pendingShifts, setPendingShifts] = useState<Shift[]>([]);
  const [todayCoworkers, setTodayCoworkers] = useState<CoworkerShift[]>([]);
  const [weekCoworkers, setWeekCoworkers] = useState<CoworkerShift[]>([]);
  const [viewScope, setViewScope] = useState<ViewScope>('branch');
  const [detailDay, setDetailDay] = useState<Date | null>(null);
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

  const [viewWeekOffset, setViewWeekOffset] = useState(0);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const today = new Date();
  const currentMonday = startOfWeekMonday();
  const monday = addWeeks(currentMonday, viewWeekOffset);
  const days = weekDates(monday);
  const weekSunday = (() => {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  })();
  const weekFrom = monday.toISOString();
  const weekTo = (() => {
    const sunday = new Date(weekSunday);
    sunday.setHours(23, 59, 59, 999);
    return sunday.toISOString();
  })();
  const isCurrentWeek = viewWeekOffset === 0;
  const weekRangeLabel = `${monday.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${weekSunday.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

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
      const [week, total, coworkers, weekWideCoworkers] = await Promise.all([
        authFetch((token) => schedulingApi.myShifts(token, { from: weekFrom, to: weekTo })),
        authFetch((token) => timeClockApi.total(token, monthToDateRange())),
        authFetch((token) => schedulingApi.coworkers(token, fullDayRange())),
        authFetch((token) => schedulingApi.coworkers(token, { from: weekFrom, to: weekTo })),
      ]);
      setWeekShifts(week.filter((s) => s.approval === 'approved'));
      setMonthTotalSeconds(total.totalSeconds);
      setTodayCoworkers(coworkers);
      setWeekCoworkers(weekWideCoworkers);

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

  // Shared by the calendar's day rows and the day-detail modal, so "who am I working with"
  // stays consistent between the summary line and the popup.
  const getDayInfo = (day: Date) => {
    const dayShifts = weekShifts.filter((shift) => isSameDay(new Date(shift.startTime), day));
    const myJobSiteForDay = dayShifts.find((s) => s.jobSite)?.jobSite;

    const dayCoworkersAll = weekCoworkers.filter(
      (c) => isSameDay(new Date(c.startTime), day) && c.employeeId._id !== user?._id,
    );
    const dayCoworkers =
      viewScope === 'me'
        ? []
        : viewScope === 'branch'
          ? dayCoworkersAll.filter((c) => myJobSiteForDay && c.jobSite === myJobSiteForDay)
          : dayCoworkersAll;

    const dayManagerPool = weekCoworkers.filter((c) => isSameDay(new Date(c.startTime), day));
    const dayManager =
      viewScope === 'branch'
        ? dayManagerPool.find(
            (c) => c.position === 'manager' && (!myJobSiteForDay || c.jobSite === myJobSiteForDay),
          )
        : dayManagerPool.find((c) => c.position === 'manager');

    return { dayShifts, myJobSiteForDay, dayCoworkers, dayManager };
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
          <View style={styles.sectionTitleRow}>
            <Ionicons name="alert-circle" size={16} color={colors.warningText} />
            <Text style={styles.sectionTitle}>Pending confirmation</Text>
          </View>
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
                    <>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </>
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
                    <>
                      <Ionicons name="close" size={14} color="#fff" />
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.weekViewNavRow}>
        <Pressable
          style={styles.weekNavButton}
          onPress={() => setViewWeekOffset((w) => w - 1)}
        >
          <Text style={styles.weekNavButtonText}>‹</Text>
        </Pressable>

        <View style={styles.weekViewTitle}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>{weekRangeLabel}</Text>
          </View>
          {isCurrentWeek ? (
            <View style={styles.currentWeekBadge}>
              <Text style={styles.currentWeekBadgeText}>This Week</Text>
            </View>
          ) : (
            <Pressable onPress={() => setViewWeekOffset(0)}>
              <Text style={styles.jumpToTodayText}>Jump to this week</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={styles.weekNavButton}
          onPress={() => setViewWeekOffset((w) => w + 1)}
        >
          <Text style={styles.weekNavButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.scopeRow}>
        {(Object.keys(SCOPE_LABELS) as ViewScope[]).map((scope) => (
          <Pressable
            key={scope}
            style={[styles.scopeButton, viewScope === scope && styles.scopeButtonActive]}
            onPress={() => setViewScope(scope)}
          >
            <Ionicons
              name={SCOPE_ICONS[scope]}
              size={14}
              color={viewScope === scope ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.scopeText, viewScope === scope && styles.scopeTextActive]}>
              {SCOPE_LABELS[scope]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.calendar}>
        {days.map((day, index) => {
          const isPast = day < today && !isSameDay(day, today);
          const isToday = isSameDay(day, today);
          const { dayShifts, dayCoworkers, dayManager } = getDayInfo(day);

          return (
            <Pressable
              key={index}
              style={[
                styles.dayRow,
                isPast && styles.dayRowPast,
                isToday && styles.dayRowToday,
              ]}
              onPress={() => setDetailDay(day)}
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
                {viewScope !== 'me' && dayManager && (
                  <Text style={[styles.dayManagerText, isPast && styles.dayTextPast]}>
                    Manager: {dayManager.employeeId._id === user?._id ? 'You' : dayManager.employeeId.fullName}
                  </Text>
                )}
                {viewScope !== 'me' && dayCoworkers.length > 0 && (
                  <Text
                    style={[styles.dayCoworkersText, isPast && styles.dayTextPast]}
                    numberOfLines={1}
                  >
                    {summarizeCoworkers(dayCoworkers)}
                  </Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.coworkersBox}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="people-outline" size={16} color={colors.text} />
          <Text style={styles.sectionTitleDark}>Working Today</Text>
        </View>
        {todayCoworkers.length === 0 ? (
          <View style={styles.emptyRow}>
            <Ionicons name="moon-outline" size={15} color={colors.textFaint} />
            <Text style={styles.noShift}>No one scheduled today</Text>
          </View>
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
        <View style={styles.monthLabelRow}>
          <Ionicons name="bar-chart-outline" size={16} color={colors.textMuted} />
          <Text style={styles.monthLabel}>Worked this month</Text>
        </View>
        <Text style={styles.monthValue}>
          {monthTotalSeconds === null ? '—' : formatHoursMinutes(monthTotalSeconds)}
        </Text>
      </View>

      {canManage && (
        <Pressable
          style={styles.buildScheduleButton}
          onPress={() => navigation.navigate('BuildSchedule')}
        >
          <Ionicons name="construct-outline" size={18} color="#fff" />
          <Text style={styles.newShiftButtonText}>Build Week Schedule</Text>
        </Pressable>
      )}

      {canManage && (
        <Pressable style={styles.newShiftButton} onPress={() => setIsModalOpen(true)}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.newShiftButtonText}>New Shift</Text>
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

      <Modal
        visible={detailDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailDay(null)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ gap: 12 }}>
            {detailDay && (
              <>
                <Text style={styles.formTitle}>
                  {detailDay.toLocaleDateString([], {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>

                {(() => {
                  const { dayShifts, dayCoworkers, dayManager } = getDayInfo(detailDay);
                  return (
                    <>
                      <Text style={styles.sectionLabel}>Your Shift</Text>
                      {dayShifts.length === 0 ? (
                        <Text style={styles.noShift}>You're not scheduled this day</Text>
                      ) : (
                        dayShifts.map((shift) => (
                          <Text key={shift._id} style={styles.detailShiftText}>
                            {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                            {shift.position ? ` · ${POSITION_LABELS[shift.position]}` : ''}
                            {shift.jobSite ? ` · ${shift.jobSite}` : ''}
                          </Text>
                        ))
                      )}

                      {dayManager && (
                        <>
                          <Text style={styles.sectionLabel}>Manager</Text>
                          <View style={styles.detailPersonRow}>
                            <Ionicons name="shield-checkmark-outline" size={16} color={colors.indigo} />
                            <Text style={styles.detailPersonText}>
                              {dayManager.employeeId._id === user?._id
                                ? 'You'
                                : dayManager.employeeId.fullName}
                            </Text>
                          </View>
                        </>
                      )}

                      <Text style={styles.sectionLabel}>
                        Coworkers ({SCOPE_LABELS[viewScope]}
                        {dayCoworkers.length > 0 ? ` · ${dayCoworkers.length}` : ''})
                      </Text>
                      {viewScope === 'me' ? (
                        <Text style={styles.noShift}>Switch to My Branch or All Branches to see who else is working</Text>
                      ) : dayCoworkers.length === 0 ? (
                        <Text style={styles.noShift}>No one else scheduled this day in that scope</Text>
                      ) : (
                        dayCoworkers.map((coworker) => (
                          <View key={coworker._id} style={styles.detailPersonRow}>
                            <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                            <View style={styles.detailPersonInfo}>
                              <Text style={styles.detailPersonText}>{coworker.employeeId.fullName}</Text>
                              <Text style={styles.detailPersonMeta}>
                                {formatTime(coworker.startTime)}–{formatTime(coworker.endTime)}
                                {coworker.position ? ` · ${POSITION_LABELS[coworker.position]}` : ''}
                                {viewScope === 'all' && coworker.jobSite ? ` · ${coworker.jobSite}` : ''}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </>
                  );
                })()}

                <Pressable style={styles.cancelButton} onPress={() => setDetailDay(null)}>
                  <Text style={styles.cancelButtonText}>Close</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  weekViewNavRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekViewTitle: { flex: 1, alignItems: 'center', gap: 2 },
  currentWeekBadge: {
    backgroundColor: colors.infoBg,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  currentWeekBadgeText: { fontSize: 11, fontWeight: '700', color: colors.infoText },
  jumpToTodayText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  scopeRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  scopeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 6,
  },
  scopeButtonActive: { backgroundColor: colors.primary },
  scopeText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  scopeTextActive: { color: '#fff' },
  detailShiftText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  detailPersonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailPersonInfo: { flex: 1 },
  detailPersonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  detailPersonMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.warningText },
  pendingBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pendingText: { fontSize: 13, color: colors.text, flex: 1 },
  pendingActions: { flexDirection: 'row', gap: 6 },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  confirmButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  rejectButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  calendar: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayRowPast: { backgroundColor: '#f5f5f5' },
  dayRowToday: { backgroundColor: colors.infoBg },
  dayHeader: { width: 64 },
  dayLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  dayDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dayTextPast: { color: colors.textFaint },
  dayShifts: { flex: 1, justifyContent: 'center', gap: 2 },
  dayManagerText: { fontSize: 12, color: colors.indigo, fontWeight: '600' },
  dayCoworkersText: { fontSize: 12, color: colors.textMuted },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noShift: { fontSize: 13, color: colors.textFaint },
  shiftText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  monthBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    ...cardShadow,
  },
  monthLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthLabel: { fontSize: 14, color: colors.textMuted },
  monthValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  coworkersBox: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  coworkerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  coworkerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  coworkerMeta: { fontSize: 13, color: colors.textMuted },
  newShiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
  },
  newShiftButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buildScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    borderRadius: 10,
    padding: 14,
  },
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

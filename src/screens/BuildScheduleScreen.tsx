import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { availabilityApi, branchesApi, HttpError, schedulingApi, usersApi } from '../api/client';
import { POSITIONS } from '../types/api';
import type { Branch, OrgAvailabilityEntry, OrgMember, Position, Shift } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import { NoteBox } from '../components/NoteBox';
import { PopupModal } from '../components/PopupModal';
import { TimeInput } from '../components/TimeInput';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

function summarizeEntry(entry: OrgAvailabilityEntry): string {
  if (entry.status === 'flexible') return 'Flexible — no preference';
  const time = entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime}` : '';
  const positions = entry.positions?.length
    ? entry.positions.map((p) => POSITION_LABELS[p]).join(', ')
    : '';
  return [time, positions].filter(Boolean).join(' · ');
}

interface ModalTarget {
  employeeId: string;
  employeeName: string;
  day: Date;
}

// A small colored pill for a branch name. Shift.jobSite stores a plain-text snapshot of the
// branch's name rather than a reference to it, so the color still comes from hashing the name
// (colorForBranch) rather than a per-branch lookup table.
function BranchTag({ jobSite }: { jobSite: string }) {
  const color = colorForBranch(jobSite);
  return (
    <View style={[styles.branchTag, { backgroundColor: `${color}1a`, borderColor: color }]}>
      <Text style={[styles.branchTagText, { color }]}>{jobSite}</Text>
    </View>
  );
}

export default function BuildScheduleScreen() {
  const { authFetch } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [availability, setAvailability] = useState<OrgAvailabilityEntry[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [modalStartTime, setModalStartTime] = useState('09:00');
  const [modalEndTime, setModalEndTime] = useState('17:00');
  const [modalPosition, setModalPosition] = useState<Position | null>(null);
  const [modalJobSite, setModalJobSite] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const monday = addWeeks(startOfWeekMonday(), weekOffset);
  const days = weekDates(monday);
  const sunday = (() => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  })();
  const weekFrom = monday.toISOString();
  const weekTo = sunday.toISOString();
  const weekLabel = `${monday.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  const load = useCallback(async () => {
    try {
      const [orgAvailability, allShifts, orgMembers, orgBranches] = await Promise.all([
        authFetch((token) => availabilityApi.all(token, { from: weekFrom, to: weekTo })),
        authFetch((token) => schedulingApi.all(token)),
        authFetch((token) => usersApi.list(token)),
        authFetch((token) => branchesApi.list(token)),
      ]);
      setAvailability(orgAvailability);
      setShifts(allShifts);
      setMembers(orgMembers);
      setBranches(orgBranches);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load schedule builder');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, weekFrom, weekTo]);

  useEffect(() => {
    load();
  }, [load]);

  const nameFor = (employeeId: string) =>
    members.find((m) => m._id === employeeId)?.fullName ?? 'Unknown';

  const openAddModal = (employeeId: string, employeeName: string, day: Date) => {
    const entry = availability.find(
      (a) => a.employeeId._id === employeeId && isSameDay(new Date(a.date), day),
    );
    setModalTarget({ employeeId, employeeName, day });
    setModalStartTime(entry?.startTime ?? '09:00');
    setModalEndTime(entry?.endTime ?? '17:00');
    setModalPosition(entry?.positions?.[0] ?? null);
    setModalJobSite('');
    setError(null);
  };

  const onCreateShift = async () => {
    if (!modalTarget) return;
    if (!TIME_PATTERN.test(modalStartTime) || !TIME_PATTERN.test(modalEndTime)) {
      setError('Start/end time must be HH:mm');
      return;
    }
    const startTime = combineDateAndTime(modalTarget.day, modalStartTime);
    const endTime = combineDateAndTime(modalTarget.day, modalEndTime);
    if (endTime <= startTime) {
      setError('End time must be after start time');
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      await authFetch((token) =>
        schedulingApi.create(token, {
          employeeId: modalTarget.employeeId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          jobSite: modalJobSite.trim() || undefined,
          position: modalPosition ?? undefined,
        }),
      );
      setModalTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not add to schedule');
    } finally {
      setIsCreating(false);
    }
  };

  const onRemoveDraft = async (shiftId: string) => {
    setError(null);
    setRejectingId(shiftId);
    try {
      await authFetch((token) => schedulingApi.reject(token, shiftId));
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not remove shift');
    } finally {
      setRejectingId(null);
    }
  };

  const onPublish = async () => {
    setError(null);
    setPublishMessage(null);
    setIsPublishing(true);
    try {
      const result = await authFetch((token) =>
        schedulingApi.publishWeek(token, { from: weekFrom, to: weekTo }),
      );
      setPublishMessage(
        result.publishedCount === 0
          ? 'Nothing to publish — no draft shifts this week'
          : `Published ${result.publishedCount} shift${result.publishedCount === 1 ? '' : 's'} — now visible to employees`,
      );
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not publish week');
    } finally {
      setIsPublishing(false);
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
      <View style={styles.weekNavRow}>
        <Pressable style={styles.weekNavButton} onPress={() => setWeekOffset((w) => w - 1)}>
          <Text style={styles.weekNavButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.weekNavLabel}>{weekLabel}</Text>
        <Pressable style={styles.weekNavButton} onPress={() => setWeekOffset((w) => w + 1)}>
          <Text style={styles.weekNavButtonText}>›</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {publishMessage && <NoteBox variant="success">{publishMessage}</NoteBox>}

      {days.map((day, index) => {
        const candidates = availability.filter(
          (a) => a.status !== 'unavailable' && isSameDay(new Date(a.date), day),
        );

        const dayShifts = shifts.filter(
          (s) => s.approval !== 'rejected' && isSameDay(new Date(s.startTime), day),
        );
        const scheduledEmployeeIds = new Set(dayShifts.map((s) => s.employeeId));

        return (
          <View key={index} style={styles.dayCard}>
            <View style={styles.dayHeaderRow}>
              <Ionicons name="calendar-outline" size={15} color={colors.text} />
              <Text style={styles.dayHeaderText}>
                {DAY_LABELS[index]} · {day.toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </Text>
            </View>

            <Text style={styles.subLabel}>Available</Text>
            {candidates.length === 0 ? (
              <Text style={styles.emptyText}>No one marked themselves available</Text>
            ) : (
              candidates.map((entry) => (
                <View key={entry.employeeId._id} style={styles.candidateRow}>
                  <View style={styles.candidateInfo}>
                    <Text style={styles.candidateName}>
                      {entry.employeeId.fullName}
                      {scheduledEmployeeIds.has(entry.employeeId._id) ? (
                        <Text style={styles.candidateScheduledBadge}> ✓ scheduled</Text>
                      ) : null}
                    </Text>
                    <Text style={styles.candidateMeta}>{summarizeEntry(entry)}</Text>
                  </View>
                  <Pressable
                    style={styles.addButton}
                    onPress={() => openAddModal(entry.employeeId._id, entry.employeeId.fullName, day)}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                  </Pressable>
                </View>
              ))
            )}

            <Text style={styles.subLabel}>Scheduled</Text>
            {dayShifts.length === 0 ? (
              <Text style={styles.emptyText}>Nothing scheduled yet</Text>
            ) : (
              dayShifts.map((shift) => (
                <View key={shift._id} style={styles.scheduledRow}>
                  <Ionicons
                    name={shift.position ? POSITION_ICONS[shift.position] : 'person-outline'}
                    size={16}
                    color={shift.position ? POSITION_COLORS[shift.position] : colors.textMuted}
                  />
                  <View style={styles.candidateInfo}>
                    <Text style={styles.candidateName}>{nameFor(shift.employeeId)}</Text>
                    <Text style={styles.candidateMeta}>
                      {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                      {shift.position ? ` · ${POSITION_LABELS[shift.position]}` : ''}
                    </Text>
                  </View>
                  {shift.jobSite && <BranchTag jobSite={shift.jobSite} />}
                  {shift.approval === 'approved' ? (
                    <View style={styles.publishedBadge}>
                      <Text style={styles.publishedBadgeText}>Published</Text>
                    </View>
                  ) : (
                    <View style={styles.draftRow}>
                      <View style={styles.draftBadge}>
                        <Text style={styles.draftBadgeText}>Draft</Text>
                      </View>
                      <Pressable
                        style={styles.removeButton}
                        onPress={() => onRemoveDraft(shift._id)}
                        disabled={rejectingId === shift._id}
                      >
                        {rejectingId === shift._id ? (
                          <ActivityIndicator color={colors.danger} size="small" />
                        ) : (
                          <Ionicons name="trash-outline" size={15} color={colors.danger} />
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        );
      })}

      <Pressable
        style={[styles.publishButton, isPublishing && styles.buttonDisabled]}
        onPress={onPublish}
        disabled={isPublishing}
      >
        {isPublishing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="megaphone-outline" size={18} color="#fff" />
            <Text style={styles.publishButtonText}>Publish Week</Text>
          </>
        )}
      </Pressable>

      <PopupModal visible={modalTarget !== null} onClose={() => setModalTarget(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.formTitle}>Add to Schedule</Text>
            {modalTarget && (
              <Text style={styles.modalSubtitle}>
                {modalTarget.employeeName} ·{' '}
                {modalTarget.day.toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            )}

            <Text style={styles.sectionLabel}>Time</Text>
            <View style={styles.timeRow}>
              <TimeInput placeholder="09:00" value={modalStartTime} onChange={setModalStartTime} />
              <Text style={styles.timeSeparator}>–</Text>
              <TimeInput placeholder="17:00" value={modalEndTime} onChange={setModalEndTime} />
            </View>

            <Text style={styles.sectionLabel}>Position (optional)</Text>
            <View style={styles.chipsWrap}>
              {POSITIONS.map((position) => {
                const isActive = modalPosition === position;
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
                    onPress={() => setModalPosition(isActive ? null : position)}
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

            <Text style={styles.sectionLabel}>Branch (optional)</Text>
            {branches.length === 0 ? (
              <Text style={styles.noBranchesText}>
                No branches yet — add one from Manage Branches
              </Text>
            ) : (
              <View style={styles.chipsWrap}>
                {branches.map((branch) => (
                  <Pressable
                    key={branch._id}
                    style={[styles.chip, modalJobSite === branch.name && styles.chipActive]}
                    onPress={() =>
                      setModalJobSite(modalJobSite === branch.name ? '' : branch.name)
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        modalJobSite === branch.name && styles.chipTextActive,
                      ]}
                    >
                      {branch.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, isCreating && styles.buttonDisabled]}
              onPress={onCreateShift}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Add</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => setModalTarget(null)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
      </PopupModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  error: { color: colors.danger },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  weekNavLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    ...cardShadow,
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dayHeaderText: { fontSize: 14, fontWeight: '700', color: colors.text },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  emptyText: { fontSize: 13, color: colors.textFaint, marginTop: 2 },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  candidateInfo: { flex: 1 },
  candidateName: { fontSize: 14, fontWeight: '600', color: colors.text },
  candidateScheduledBadge: { fontSize: 11, fontWeight: '600', color: colors.success },
  candidateMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  draftBadge: {
    backgroundColor: colors.warningBg,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  draftBadgeText: { fontSize: 11, fontWeight: '700', color: colors.warningText },
  publishedBadge: {
    backgroundColor: colors.successBg,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  publishedBadgeText: { fontSize: 11, fontWeight: '700', color: colors.successText },
  removeButton: { padding: 4 },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  publishButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  noBranchesText: { fontSize: 13, color: colors.textFaint },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSeparator: { fontSize: 15, color: colors.textMuted },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  branchTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  branchTagText: { fontSize: 11, fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 14 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

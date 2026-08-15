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
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { HttpError, tasksApi, usersApi } from '../api/client';
import { POSITIONS } from '../types/api';
import type { OrgMember, OrgTask, Position, Task, TaskStatus } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import { NoteBox } from '../components/NoteBox';
import { PopupModal } from '../components/PopupModal';
import type { AppStackParamList } from '../navigation/types';

type IconName = keyof typeof Ionicons.glyphMap;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

const STATUS_ICONS: Record<TaskStatus, IconName> = {
  pending: 'ellipse-outline',
  in_progress: 'hourglass-outline',
  done: 'checkmark-circle',
};

const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'done'];

function startOfWeekMonday(date = new Date()) {
  const dayOfWeek = date.getDay();
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

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function TasksScreen() {
  const { user, authFetch } = useAuth();
  const route = useRoute<RouteProp<AppStackParamList, 'Tasks'>>();
  const [dateFilter, setDateFilter] = useState<Date | null>(
    route.params?.dueDate ? new Date(route.params.dueDate) : null,
  );
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [orgTasks, setOrgTasks] = useState<OrgTask[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'person' | 'position'>('person');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [modalWeekOffset, setModalWeekOffset] = useState(0);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [batchResultsNote, setBatchResultsNote] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const visibleMyTasks = dateFilter
    ? myTasks.filter((t) => isSameDay(new Date(t.dueDate), dateFilter))
    : myTasks;
  const visibleOrgTasks = dateFilter
    ? orgTasks.filter((t) => isSameDay(new Date(t.dueDate), dateFilter))
    : orgTasks;

  const monday = startOfWeekMonday();
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
      const mine = await authFetch((token) => tasksApi.mine(token));
      setMyTasks(mine);

      if (canManage) {
        const [all, orgMembers] = await Promise.all([
          authFetch((token) => tasksApi.all(token)),
          authFetch((token) => usersApi.list(token)),
        ]);
        setOrgTasks(all);
        setMembers(orgMembers);
      }
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDate = (day: Date) => {
    if (assignMode === 'person') {
      setSelectedDates([day]);
      return;
    }
    setSelectedDates((prev) =>
      prev.some((d) => isSameDay(d, day))
        ? prev.filter((d) => !isSameDay(d, day))
        : [...prev, day],
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedEmployeeId(null);
    setSelectedPosition(null);
    setSelectedDates([]);
    setBatchResultsNote(null);
  };

  const onCreateTask = async () => {
    if (!title.trim()) {
      setError('Give the task a title');
      return;
    }
    if (selectedDates.length === 0) {
      setError('Pick at least one due date');
      return;
    }

    setError(null);
    setBatchResultsNote(null);
    setIsCreating(true);
    try {
      if (assignMode === 'person') {
        if (!selectedEmployeeId) {
          setError('Pick who this task is for');
          setIsCreating(false);
          return;
        }
        await authFetch((token) =>
          tasksApi.create(token, {
            title: title.trim(),
            description: description.trim() || undefined,
            dueDate: selectedDates[0].toISOString(),
            assignedTo: selectedEmployeeId,
          }),
        );
      } else {
        if (!selectedPosition) {
          setError('Pick a position');
          setIsCreating(false);
          return;
        }
        const results = await authFetch((token) =>
          tasksApi.createBatch(token, {
            title: title.trim(),
            description: description.trim() || undefined,
            position: selectedPosition,
            dueDates: selectedDates.map((d) => d.toISOString()),
          }),
        );
        const missed = results.filter((r) => !r.created);
        if (missed.length > 0) {
          setBatchResultsNote(
            `${results.length - missed.length} of ${results.length} created — no one was working ${POSITION_LABELS[selectedPosition]} on ${missed.length} of the picked days.`,
          );
        }
      }
      resetForm();
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not create task');
    } finally {
      setIsCreating(false);
    }
  };

  const onAdvanceStatus = async (task: Task) => {
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextStatus = STATUS_ORDER[currentIndex + 1];
    if (!nextStatus) return;

    setError(null);
    setUpdatingId(task._id);
    try {
      await authFetch((token) => tasksApi.updateStatus(token, task._id, nextStatus));
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not update task');
    } finally {
      setUpdatingId(null);
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

      {dateFilter && (
        <NoteBox variant="info">
          Showing tasks due {formatDueDate(dateFilter.toISOString())}.{' '}
          <Text style={styles.clearFilterLink} onPress={() => setDateFilter(null)}>
            Show all tasks
          </Text>
        </NoteBox>
      )}

      <View style={styles.sectionTitleRow}>
        <Ionicons name="list-outline" size={16} color={colors.text} />
        <Text style={styles.sectionTitleDark}>My Tasks</Text>
      </View>
      {visibleMyTasks.length === 0 ? (
        <View style={styles.emptyRow}>
          <Ionicons name="checkmark-done-outline" size={15} color={colors.textFaint} />
          <Text style={styles.empty}>
            {dateFilter ? 'No tasks of yours are due this day' : 'No tasks assigned to you'}
          </Text>
        </View>
      ) : (
        visibleMyTasks.map((task) => (
          <View key={task._id} style={styles.taskRow}>
            <Ionicons
              name={STATUS_ICONS[task.status]}
              size={20}
              color={task.status === 'done' ? colors.success : colors.textMuted}
            />
            <View style={styles.taskInfo}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {task.description ? (
                <Text style={styles.taskDescription}>{task.description}</Text>
              ) : null}
              <Text style={styles.taskMeta}>
                Due {formatDueDate(task.dueDate)}
                {task.position ? ` · ${POSITION_LABELS[task.position]}` : ''}
              </Text>
            </View>
            {task.status === 'done' ? (
              <View style={styles.statusBadgeDone}>
                <Text style={styles.statusBadgeDoneText}>Done</Text>
              </View>
            ) : (
              <Pressable
                style={styles.statusButton}
                onPress={() => onAdvanceStatus(task)}
                disabled={updatingId === task._id}
              >
                {updatingId === task._id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.statusButtonText}>{STATUS_LABELS[task.status]}</Text>
                )}
              </Pressable>
            )}
          </View>
        ))
      )}

      {canManage && (
        <>
          <View style={[styles.sectionTitleRow, { marginTop: 8 }]}>
            <Ionicons name="albums-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>All Tasks</Text>
          </View>
          {visibleOrgTasks.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="file-tray-outline" size={15} color={colors.textFaint} />
              <Text style={styles.empty}>
                {dateFilter ? 'No tasks are due this day' : 'No tasks created yet'}
              </Text>
            </View>
          ) : (
            visibleOrgTasks.map((task) => (
              <View key={task._id} style={styles.taskRow}>
                <Ionicons
                  name={STATUS_ICONS[task.status]}
                  size={20}
                  color={task.status === 'done' ? colors.success : colors.textMuted}
                />
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskMeta}>
                    {task.assignedTo.fullName} · Due {formatDueDate(task.dueDate)}
                    {task.position ? ` · ${POSITION_LABELS[task.position]}` : ''}
                  </Text>
                </View>
                <Text style={styles.taskStatusLabel}>{STATUS_LABELS[task.status]}</Text>
              </View>
            ))
          )}

          <Pressable
            style={styles.newTaskButton}
            onPress={() => {
              resetForm();
              setAssignMode('person');
              setIsModalOpen(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.newTaskButtonText}>New Task</Text>
          </Pressable>
        </>
      )}

      <PopupModal visible={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ gap: 12 }}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="add-circle-outline" size={18} color={colors.text} />
              <Text style={styles.formTitle}>New Task</Text>
            </View>

            <View style={styles.chipsWrap}>
              <Pressable
                style={[styles.chip, assignMode === 'person' && styles.chipActive]}
                onPress={() => {
                  setAssignMode('person');
                  setSelectedDates((prev) => prev.slice(0, 1));
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={assignMode === 'person' ? '#fff' : colors.text}
                />
                <Text
                  style={[styles.chipText, assignMode === 'person' && styles.chipTextActive]}
                >
                  A specific person
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, assignMode === 'position' && styles.chipActive]}
                onPress={() => setAssignMode('position')}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={14}
                  color={assignMode === 'position' ? '#fff' : colors.text}
                />
                <Text
                  style={[styles.chipText, assignMode === 'position' && styles.chipTextActive]}
                >
                  Whoever works a position
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              value={description}
              onChangeText={setDescription}
            />

            {assignMode === 'person' ? (
              <>
                <Text style={styles.sectionLabel}>For</Text>
                <View style={styles.chipsWrap}>
                  {members.map((member) => (
                    <Pressable
                      key={member._id}
                      style={[
                        styles.chip,
                        selectedEmployeeId === member._id && styles.chipActive,
                      ]}
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
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Position</Text>
                <View style={styles.chipsWrap}>
                  {POSITIONS.map((position) => {
                    const isActive = selectedPosition === position;
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
                        onPress={() => setSelectedPosition(position)}
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
              </>
            )}

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

            <Text style={styles.sectionLabel}>
              {assignMode === 'position' ? 'Due date(s)' : 'Due date'}
            </Text>
            <View style={styles.chipsWrap}>
              {modalWeekDays.map((day, index) => {
                const isSelected = selectedDates.some((d) => isSameDay(d, day));
                return (
                  <Pressable
                    key={index}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => toggleDate(day)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {DAY_LABELS[index]} {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {batchResultsNote && <NoteBox variant="warning">{batchResultsNote}</NoteBox>}
            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, isCreating && styles.buttonDisabled]}
              onPress={onCreateTask}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Create Task</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => setIsModalOpen(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
      </PopupModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { fontSize: 13, color: colors.textFaint },
  clearFilterLink: { fontWeight: '700', textDecorationLine: 'underline' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    ...cardShadow,
  },
  taskInfo: { flex: 1, gap: 2 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  taskDescription: { fontSize: 13, color: colors.textMuted },
  taskMeta: { fontSize: 12, color: colors.textMuted },
  taskStatusLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  statusButton: {
    backgroundColor: colors.teal,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statusBadgeDone: {
    backgroundColor: colors.successBg,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusBadgeDoneText: { color: colors.successText, fontSize: 12, fontWeight: '600' },
  newTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  newTaskButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
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
  weekNavLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 14 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

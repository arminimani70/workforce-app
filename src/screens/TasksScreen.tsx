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
import { HttpError, tasksApi, usersApi } from '../api/client';
import { POSITIONS } from '../types/api';
import type { OrgMember, OrgTask, Position, Task, TaskStatus } from '../types/api';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const POSITION_LABELS: Record<Position, string> = {
  frontdesk: 'Front Desk',
  helpdesk: 'Help Desk',
  information: 'Information',
  consultation: 'Consultation',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
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

      <Text style={styles.sectionTitleDark}>My Tasks</Text>
      {myTasks.length === 0 ? (
        <Text style={styles.empty}>No tasks assigned to you</Text>
      ) : (
        myTasks.map((task) => (
          <View key={task._id} style={styles.taskRow}>
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
          <Text style={[styles.sectionTitleDark, { marginTop: 8 }]}>All Tasks</Text>
          {orgTasks.length === 0 ? (
            <Text style={styles.empty}>No tasks created yet</Text>
          ) : (
            orgTasks.map((task) => (
              <View key={task._id} style={styles.taskRow}>
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
            <Text style={styles.newTaskButtonText}>+ New Task</Text>
          </Pressable>
        </>
      )}

      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ gap: 12 }}>
            <Text style={styles.formTitle}>New Task</Text>

            <View style={styles.chipsWrap}>
              <Pressable
                style={[styles.chip, assignMode === 'person' && styles.chipActive]}
                onPress={() => {
                  setAssignMode('person');
                  setSelectedDates((prev) => prev.slice(0, 1));
                }}
              >
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
                  {POSITIONS.map((position) => (
                    <Pressable
                      key={position}
                      style={[styles.chip, selectedPosition === position && styles.chipActive]}
                      onPress={() => setSelectedPosition(position)}
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

            {batchResultsNote && <Text style={styles.note}>{batchResultsNote}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, isCreating && styles.buttonDisabled]}
              onPress={onCreateTask}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Task</Text>
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
  content: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#c0392b' },
  note: { color: '#92400e', fontSize: 12 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 4 },
  empty: { fontSize: 13, color: '#999' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
  },
  taskInfo: { flex: 1, gap: 2 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  taskDescription: { fontSize: 13, color: '#555' },
  taskMeta: { fontSize: 12, color: '#666' },
  taskStatusLabel: { fontSize: 12, fontWeight: '600', color: '#666' },
  statusButton: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statusBadgeDone: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusBadgeDoneText: { color: '#166534', fontSize: 12, fontWeight: '600' },
  newTaskButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  newTaskButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: '#666', fontSize: 14 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

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
import { availabilityApi, HttpError } from '../api/client';
import { POSITIONS } from '../types/api';
import type { DayAvailability, DayAvailabilityStatus, Position } from '../types/api';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const POSITION_LABELS: Record<Position, string> = {
  frontdesk: 'Front Desk',
  helpdesk: 'Help Desk',
  information: 'Information',
  consultation: 'Consultation',
};

function defaultDays(): DayAvailability[] {
  return DAY_LABELS.map((_, dayOfWeek) => ({ dayOfWeek, status: 'unavailable', positions: [] }));
}

function summarize(day: DayAvailability): string {
  if (day.status === 'unavailable') return 'Unavailable';
  if (day.status === 'flexible') return 'Flexible — manager decides';
  const time = day.startTime && day.endTime ? `${day.startTime}–${day.endTime}` : 'No time set';
  const positions = day.positions?.length
    ? day.positions.map((p) => POSITION_LABELS[p]).join(', ')
    : 'No position set';
  return `${time} · ${positions}`;
}

export default function AvailabilityScreen() {
  const { authFetch } = useAuth();
  const [days, setDays] = useState<DayAvailability[]>(defaultDays());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const availability = await authFetch((token) => availabilityApi.getMine(token));
      setDays(availability.days);
    } catch (err) {
      setMessage(err instanceof HttpError ? err.message : 'Could not load availability');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const updateDay = (dayOfWeek: number, patch: Partial<DayAvailability>) => {
    setDays((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)),
    );
  };

  const togglePosition = (dayOfWeek: number, position: Position) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        const current = day.positions ?? [];
        const positions = current.includes(position)
          ? current.filter((p) => p !== position)
          : [...current, position];
        return { ...day, positions };
      }),
    );
  };

  const setStatus = (dayOfWeek: number, status: DayAvailabilityStatus) => {
    updateDay(dayOfWeek, {
      status,
      startTime: status === 'available' ? (days.find((d) => d.dayOfWeek === dayOfWeek)?.startTime ?? '09:00') : undefined,
      endTime: status === 'available' ? (days.find((d) => d.dayOfWeek === dayOfWeek)?.endTime ?? '17:00') : undefined,
    });
  };

  const onSave = async () => {
    setMessage(null);
    setIsSaving(true);
    try {
      await authFetch((token) => availabilityApi.updateMine(token, days));
      setMessage('Saved');
    } catch (err) {
      setMessage(err instanceof HttpError ? err.message : 'Could not save availability');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const editingDay = openDay !== null ? days.find((d) => d.dayOfWeek === openDay) : undefined;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {days.map((day) => (
          <Pressable
            key={day.dayOfWeek}
            style={styles.dayRow}
            onPress={() => setOpenDay(day.dayOfWeek)}
          >
            <Text style={styles.dayLabel}>{DAY_LABELS[day.dayOfWeek]}</Text>
            <Text style={styles.daySummary}>{summarize(day)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {message && <Text style={styles.message}>{message}</Text>}

      <Pressable
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </Pressable>

      <Modal visible={openDay !== null} animationType="slide" transparent onRequestClose={() => setOpenDay(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {editingDay && (
              <>
                <Text style={styles.modalTitle}>{DAY_LABELS[editingDay.dayOfWeek]}</Text>

                <View style={styles.statusRow}>
                  {(['unavailable', 'available', 'flexible'] as DayAvailabilityStatus[]).map(
                    (status) => (
                      <Pressable
                        key={status}
                        style={[
                          styles.statusButton,
                          editingDay.status === status && styles.statusButtonActive,
                        ]}
                        onPress={() => setStatus(editingDay.dayOfWeek, status)}
                      >
                        <Text
                          style={[
                            styles.statusButtonText,
                            editingDay.status === status && styles.statusButtonTextActive,
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

                {editingDay.status === 'available' && (
                  <>
                    <View style={styles.timeRow}>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="09:00"
                        value={editingDay.startTime}
                        onChangeText={(value) =>
                          updateDay(editingDay.dayOfWeek, { startTime: value })
                        }
                      />
                      <Text style={styles.timeSeparator}>–</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="17:00"
                        value={editingDay.endTime}
                        onChangeText={(value) =>
                          updateDay(editingDay.dayOfWeek, { endTime: value })
                        }
                      />
                    </View>

                    <Text style={styles.sectionLabel}>Positions</Text>
                    <View style={styles.positionsWrap}>
                      {POSITIONS.map((position) => {
                        const selected = editingDay.positions?.includes(position) ?? false;
                        return (
                          <Pressable
                            key={position}
                            style={[styles.positionChip, selected && styles.positionChipActive]}
                            onPress={() => togglePosition(editingDay.dayOfWeek, position)}
                          >
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

                <Pressable style={styles.doneButton} onPress={() => setOpenDay(null)}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { gap: 8, paddingBottom: 16 },
  dayRow: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 14,
  },
  dayLabel: { fontSize: 16, fontWeight: '600', color: '#111' },
  daySummary: { fontSize: 13, color: '#666', marginTop: 4 },
  message: { textAlign: 'center', color: '#666', marginBottom: 8 },
  saveButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusButtonActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  statusButtonText: { fontSize: 13, fontWeight: '600', color: '#333' },
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
  timeSeparator: { fontSize: 15, color: '#666' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 8 },
  positionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  positionChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  positionChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  positionChipText: { fontSize: 13, color: '#333' },
  positionChipTextActive: { color: '#fff' },
  doneButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

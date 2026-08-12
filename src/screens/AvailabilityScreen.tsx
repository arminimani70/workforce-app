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
import type { DayAvailability, DayAvailabilityStatus, Position } from '../types/api';
import { cardShadow, colors } from '../theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_ICONS: Record<DayAvailabilityStatus, IconName> = {
  unavailable: 'close-circle-outline',
  available: 'checkmark-circle-outline',
  flexible: 'swap-horizontal-outline',
};

const STATUS_ICON_COLORS: Record<DayAvailabilityStatus, string> = {
  unavailable: colors.textFaint,
  available: colors.success,
  flexible: colors.purple,
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const POSITION_LABELS: Record<Position, string> = {
  frontdesk: 'Front Desk',
  helpdesk: 'Help Desk',
  information: 'Information',
  consultation: 'Consultation',
  manager: 'Manager',
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
      <View style={styles.sectionTitleRow}>
        <Ionicons name="calendar-outline" size={16} color={colors.text} />
        <Text style={styles.sectionTitleDark}>Weekly Availability</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {days.map((day) => (
          <Pressable
            key={day.dayOfWeek}
            style={styles.dayRow}
            onPress={() => setOpenDay(day.dayOfWeek)}
          >
            <Ionicons
              name={STATUS_ICONS[day.status]}
              size={22}
              color={STATUS_ICON_COLORS[day.status]}
              style={styles.dayIcon}
            />
            <View style={styles.dayTextGroup}>
              <Text style={styles.dayLabel}>{DAY_LABELS[day.dayOfWeek]}</Text>
              <Text style={styles.daySummary}>{summarize(day)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
          <>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>Save</Text>
          </>
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
                        <Ionicons
                          name={STATUS_ICONS[status]}
                          size={16}
                          color={editingDay.status === status ? '#fff' : STATUS_ICON_COLORS[status]}
                        />
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
                  <Ionicons name="checkmark" size={18} color="#fff" />
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
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
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
  dayIcon: { width: 22 },
  dayTextGroup: { flex: 1 },
  dayLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  daySummary: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  message: { textAlign: 'center', color: colors.textMuted, marginBottom: 8 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    borderRadius: 10,
    padding: 14,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  positionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
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
});

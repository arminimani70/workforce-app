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
import { useAuth } from '../auth/AuthContext';
import { availabilityApi, HttpError } from '../api/client';
import type { DayAvailability } from '../types/api';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function defaultDays(): DayAvailability[] {
  return DAY_LABELS.map((_, dayOfWeek) => ({ dayOfWeek, available: false }));
}

export default function AvailabilityScreen() {
  const { authFetch } = useAuth();
  const [days, setDays] = useState<DayAvailability[]>(defaultDays());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const toggleDay = (dayOfWeek: number) => {
    setDays((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              available: !day.available,
              startTime: !day.available ? (day.startTime ?? '09:00') : day.startTime,
              endTime: !day.available ? (day.endTime ?? '17:00') : day.endTime,
            }
          : day,
      ),
    );
  };

  const setTime = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setDays((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day)),
    );
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {days.map((day) => (
          <View key={day.dayOfWeek} style={styles.dayRow}>
            <Pressable
              style={[styles.dayToggle, day.available && styles.dayToggleActive]}
              onPress={() => toggleDay(day.dayOfWeek)}
            >
              <Text style={[styles.dayLabel, day.available && styles.dayLabelActive]}>
                {DAY_LABELS[day.dayOfWeek]}
              </Text>
              <Text style={[styles.dayStatus, day.available && styles.dayLabelActive]}>
                {day.available ? 'Available' : 'Unavailable'}
              </Text>
            </Pressable>

            {day.available && (
              <View style={styles.timeRow}>
                <TextInput
                  style={styles.timeInput}
                  placeholder="09:00"
                  value={day.startTime}
                  onChangeText={(value) => setTime(day.dayOfWeek, 'startTime', value)}
                />
                <Text style={styles.timeSeparator}>–</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="17:00"
                  value={day.endTime}
                  onChangeText={(value) => setTime(day.dayOfWeek, 'endTime', value)}
                />
              </View>
            )}
          </View>
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
    padding: 12,
    gap: 8,
  },
  dayToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayToggleActive: {},
  dayLabel: { fontSize: 16, fontWeight: '600', color: '#111' },
  dayLabelActive: { color: '#0f766e' },
  dayStatus: { fontSize: 13, color: '#999' },
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
  message: { textAlign: 'center', color: '#666', marginBottom: 8 },
  saveButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

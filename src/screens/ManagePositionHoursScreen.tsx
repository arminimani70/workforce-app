import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { positionDefaultHoursApi, HttpError } from '../api/client';
import { POSITIONS } from '../types/api';
import type { Position } from '../types/api';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import { cardShadow, colors } from '../theme/colors';
import { NoteBox } from '../components/NoteBox';
import { TimeInput } from '../components/TimeInput';

const FALLBACK_START = '09:00';
const FALLBACK_END = '17:00';

type Draft = { startTime: string; endTime: string };

export default function ManagePositionHoursScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<Record<Position, Draft>>(
    () =>
      Object.fromEntries(
        POSITIONS.map((p) => [p, { startTime: FALLBACK_START, endTime: FALLBACK_END }]),
      ) as Record<Position, Draft>,
  );
  const [customized, setCustomized] = useState<Set<Position>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [savingPosition, setSavingPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const defaults = await authFetch((token) => positionDefaultHoursApi.list(token));
      setDrafts((prev) => {
        const next = { ...prev };
        for (const d of defaults) {
          next[d.position] = { startTime: d.startTime, endTime: d.endTime };
        }
        return next;
      });
      setCustomized(new Set(defaults.map((d) => d.position)));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load position hours');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const updateDraft = (position: Position, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [position]: { ...prev[position], [field]: value } }));
  };

  const onSave = async (position: Position) => {
    setError(null);
    setMessage(null);
    setSavingPosition(position);
    try {
      await authFetch((token) =>
        positionDefaultHoursApi.upsert(token, { position, ...drafts[position] }),
      );
      setCustomized((prev) => new Set(prev).add(position));
      setMessage(`Saved ${POSITION_LABELS[position]}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save');
    } finally {
      setSavingPosition(null);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <NoteBox variant="info">
        Sets the start/end time that pre-fills when an employee marks themselves available for a
        position — different jobs start and end at different times. Employees can still type a
        different time for a specific day.
      </NoteBox>

      {POSITIONS.map((position) => (
        <View key={position} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={POSITION_ICONS[position]} size={18} color={POSITION_COLORS[position]} />
            <Text style={styles.cardTitle}>{POSITION_LABELS[position]}</Text>
            {!customized.has(position) && (
              <Text style={styles.defaultBadge}>using app default</Text>
            )}
          </View>
          <View style={styles.timeRow}>
            <TimeInput
              placeholder={FALLBACK_START}
              value={drafts[position].startTime}
              onChange={(v) => updateDraft(position, 'startTime', v)}
            />
            <Text style={styles.timeSeparator}>–</Text>
            <TimeInput
              placeholder={FALLBACK_END}
              value={drafts[position].endTime}
              onChange={(v) => updateDraft(position, 'endTime', v)}
            />
          </View>
          <Pressable
            style={styles.saveButton}
            onPress={() => onSave(position)}
            disabled={savingPosition === position}
          >
            {savingPosition === position ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </Pressable>
        </View>
      ))}

      {message && <NoteBox variant="success">{message}</NoteBox>}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    ...cardShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  defaultBadge: { fontSize: 11, color: colors.textFaint, fontStyle: 'italic' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSeparator: { fontSize: 15, color: colors.textMuted },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: colors.primary,
  },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { wastageApi, HttpError } from '../api/client';
import type { WastageReason } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { NoteBox } from '../components/NoteBox';

export default function ManageWastageReasonsScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [reasons, setReasons] = useState<WastageReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => wastageApi.listReasons(token));
      setReasons(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load reasons');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditingId(null);
    setLabel('');
    setMessage(null);
    setError(null);
  };

  const editReason = (reasonItem: WastageReason) => {
    setEditingId(reasonItem._id);
    setLabel(reasonItem.label);
    setMessage(null);
    setError(null);
  };

  const onSave = async () => {
    if (!label.trim()) {
      setError('Give the reason a name');
      return;
    }
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await authFetch((token) =>
        wastageApi.upsertReason(token, { id: editingId ?? undefined, label: label.trim() }),
      );
      setMessage('Saved');
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save reason');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      await authFetch((token) => wastageApi.deleteReason(token, id));
      if (editingId === id) startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not delete reason');
    } finally {
      setDeletingId(null);
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
    >
      {reasons.length === 0 ? (
        <NoteBox variant="warning">
          No wastage reasons yet — employees won't be able to submit a wastage report until at
          least one exists.
        </NoteBox>
      ) : (
        <>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="list-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>Existing Reasons</Text>
          </View>
          {reasons.map((reasonItem) => (
            <View key={reasonItem._id} style={styles.reasonRow}>
              <Pressable style={styles.reasonInfo} onPress={() => editReason(reasonItem)}>
                <Ionicons name="trash-bin-outline" size={16} color={colors.danger} />
                <Text style={styles.reasonText}>{reasonItem.label}</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(reasonItem._id)}
                disabled={deletingId === reasonItem._id}
                hitSlop={8}
              >
                {deletingId === reasonItem._id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                )}
              </Pressable>
            </View>
          ))}
        </>
      )}

      <View style={styles.sectionTitleRow}>
        <Ionicons name="create-outline" size={16} color={colors.text} />
        <Text style={styles.sectionTitleDark}>{editingId ? 'Rename Reason' : 'New Reason'}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="e.g. Expired"
        value={label}
        onChangeText={setLabel}
      />

      {message && <NoteBox variant="success">{message}</NoteBox>}
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.saveButton, isSaving && styles.buttonDisabled]}
        onPress={onSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>{editingId ? 'Save Changes' : 'Add Reason'}</Text>
          </>
        )}
      </Pressable>

      {editingId && (
        <Pressable style={styles.cancelButton} onPress={startNew}>
          <Text style={styles.cancelButtonText}>Cancel editing, add a new reason</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    ...cardShadow,
  },
  reasonInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  reasonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 13 },
});

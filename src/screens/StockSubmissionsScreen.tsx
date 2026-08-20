import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { stockApi, HttpError } from '../api/client';
import type { StockSubmission } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { toEnglishDigits } from '../utils/digits';

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StockSubmissionsScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [submissions, setSubmissions] = useState<StockSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQuantities, setDraftQuantities] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => stockApi.listSubmissions(token));
      setSubmissions(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load submissions');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (submission: StockSubmission) => {
    setError(null);
    setEditingId(submission._id);
    setDraftQuantities(
      Object.fromEntries(submission.entries.map((entry, index) => [index, String(entry.quantity)])),
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftQuantities({});
  };

  const onSaveEdit = async (submission: StockSubmission) => {
    const parsed = submission.entries.map((entry, index) => ({
      productName: entry.productName,
      quantity: Number(draftQuantities[index]),
    }));
    if (parsed.some((q) => Number.isNaN(q.quantity) || q.quantity < 0)) {
      setError('Quantities must be numbers, 0 or greater');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const updated = await authFetch((token) =>
        stockApi.updateSubmission(token, submission._id, parsed),
      );
      setSubmissions((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (submission: StockSubmission) => {
    Alert.alert(
      'Delete stock count',
      `Remove this "${submission.templateTitle}" count submitted by ${submission.employeeId.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            setDeletingId(submission._id);
            try {
              await authFetch((token) => stockApi.deleteSubmission(token, submission._id));
              setSubmissions((prev) => prev.filter((s) => s._id !== submission._id));
              if (editingId === submission._id) cancelEdit();
            } catch (err) {
              setError(err instanceof HttpError ? err.message : 'Could not delete submission');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
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
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={submissions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="file-tray-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No stock counts have been submitted yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isEditing = editingId === item._id;
          return (
            <View style={styles.submissionCard}>
              <View style={styles.submissionHeaderRow}>
                <Ionicons name="cube-outline" size={16} color={colors.primary} />
                <Text style={styles.submissionTitle}>{item.templateTitle}</Text>
                <View
                  style={[
                    styles.branchTag,
                    { backgroundColor: `${colorForBranch(item.jobSite)}1a`, borderColor: colorForBranch(item.jobSite) },
                  ]}
                >
                  <Text style={[styles.branchTagText, { color: colorForBranch(item.jobSite) }]}>
                    {item.jobSite}
                  </Text>
                </View>
                {!isEditing && (
                  <>
                    <Pressable onPress={() => startEdit(item)} hitSlop={8}>
                      <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => onDelete(item)} disabled={deletingId === item._id} hitSlop={8}>
                      {deletingId === item._id ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      )}
                    </Pressable>
                  </>
                )}
              </View>
              <Text style={styles.submissionMeta}>
                {item.employeeId.fullName} · {formatSubmittedAt(item.createdAt)}
              </Text>

              {isEditing ? (
                <>
                  {item.entries.map((entry, index) => (
                    <View key={index} style={styles.editRow}>
                      <Text style={styles.editRowLabel}>
                        {entry.productName} <Text style={styles.editRowUnit}>({entry.unit})</Text>
                      </Text>
                      <TextInput
                        style={styles.editInput}
                        value={draftQuantities[index] ?? ''}
                        onChangeText={(text) =>
                          setDraftQuantities((prev) => ({ ...prev, [index]: toEnglishDigits(text) }))
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ))}
                  <View style={styles.editActions}>
                    <Pressable style={styles.cancelButton} onPress={cancelEdit} disabled={isSaving}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.saveButton, isSaving && styles.buttonDisabled]}
                      onPress={() => onSaveEdit(item)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.saveButtonText}>Save</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                item.entries.map((entry, index) => (
                  <Text key={index} style={styles.fieldLine}>
                    <Text style={styles.fieldLabel}>{entry.productName}: </Text>
                    {entry.quantity} {entry.unit}
                  </Text>
                ))
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, marginBottom: 8 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  empty: { fontSize: 13, color: colors.textFaint },
  submissionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
    ...cardShadow,
  },
  submissionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submissionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  branchTagText: { fontSize: 11, fontWeight: '700' },
  submissionMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  fieldLine: { fontSize: 13, color: colors.text },
  fieldLabel: { fontWeight: '600', color: colors.textMuted },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4 },
  editRowLabel: { fontSize: 13, color: colors.text, flex: 1 },
  editRowUnit: { color: colors.textFaint },
  editInput: {
    width: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    textAlign: 'right',
    backgroundColor: colors.background,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { formsApi, HttpError } from '../api/client';
import type { FormSubmission } from '../types/api';
import { cardShadow, colors } from '../theme/colors';

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FormSubmissionsScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => formsApi.listSubmissions(token));
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
            <Text style={styles.empty}>No forms have been submitted yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.submissionCard}>
            <View style={styles.submissionHeaderRow}>
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={styles.submissionTitle}>{item.formTitle}</Text>
            </View>
            <Text style={styles.submissionMeta}>
              {item.employeeId.fullName} · {formatSubmittedAt(item.createdAt)}
            </Text>
            {item.values.map((fieldValue, index) => (
              <Text key={index} style={styles.fieldLine}>
                <Text style={styles.fieldLabel}>{fieldValue.label}: </Text>
                {fieldValue.value}
              </Text>
            ))}
          </View>
        )}
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
  submissionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  submissionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  submissionMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  fieldLine: { fontSize: 13, color: colors.text },
  fieldLabel: { fontWeight: '600', color: colors.textMuted },
});

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { wastageApi, HttpError } from '../api/client';
import type { WastageEntry } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WastageEntriesScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<WastageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => wastageApi.listEntries(token));
      setEntries(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load wastage reports');
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
        data={entries}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="file-tray-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No wastage has been reported yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <View style={styles.entryHeaderRow}>
              <Ionicons name="trash-bin-outline" size={16} color={colors.danger} />
              <Text style={styles.entryTitle}>
                {item.productName} — {item.amount}
              </Text>
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
            </View>
            <Text style={styles.entryMeta}>
              {item.employeeId.fullName} · {formatSubmittedAt(item.createdAt)}
            </Text>
            <Text style={styles.reasonLine}>
              <Text style={styles.reasonLabel}>Reason: </Text>
              {item.reason}
            </Text>
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
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
    ...cardShadow,
  },
  entryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  branchTagText: { fontSize: 11, fontWeight: '700' },
  entryMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  reasonLine: { fontSize: 13, color: colors.text },
  reasonLabel: { fontWeight: '600', color: colors.textMuted },
});

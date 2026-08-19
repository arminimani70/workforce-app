import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { checklistsApi, HttpError } from '../api/client';
import type { ChecklistTemplate } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import type { AppStackParamList } from '../navigation/types';

// One row per (position, branch) checklist "form" — tapping one opens its own full-page fill
// screen, same list-then-fill pattern as Stock.
export default function ChecklistScreen() {
  const { user, authFetch } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => checklistsApi.listTemplates(token));
      setTemplates(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load checklists');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
        data={templates}
        keyExtractor={(item) => item._id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="checkbox-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No checklists have been set up yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.templateRow}
            onPress={() =>
              navigation.navigate('ChecklistFill', {
                position: item.position,
                jobSite: item.jobSite,
                title: item.title,
              })
            }
          >
            <Ionicons
              name={POSITION_ICONS[item.position]}
              size={20}
              color={POSITION_COLORS[item.position]}
            />
            <View style={styles.templateTextGroup}>
              <Text style={styles.templateTitle}>
                {item.title || `${POSITION_LABELS[item.position]} Checklist`}
              </Text>
              <Text style={styles.templateMeta}>
                {item.openingItems.length} opening · {item.closingItems.length} closing
              </Text>
            </View>
            <View
              style={[
                styles.branchTag,
                item.jobSite
                  ? { backgroundColor: `${colorForBranch(item.jobSite)}1a`, borderColor: colorForBranch(item.jobSite) }
                  : { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.branchTagText,
                  { color: item.jobSite ? colorForBranch(item.jobSite) : colors.textMuted },
                ]}
              >
                {item.jobSite || 'All branches'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      />

      {canManage && (
        <View style={[styles.managerRow, { paddingBottom: insets.bottom }]}>
          <Pressable style={styles.manageButton} onPress={() => navigation.navigate('ManageChecklists')}>
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Manage Checklists</Text>
          </Pressable>
          <Pressable
            style={styles.manageButton}
            onPress={() => navigation.navigate('ChecklistSubmissions')}
          >
            <Ionicons name="time-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Submission History</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, marginBottom: 8 },
  list: { flex: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  empty: { fontSize: 13, color: colors.textFaint },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...cardShadow,
  },
  templateTextGroup: { flex: 1 },
  templateTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  templateMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  branchTagText: { fontSize: 12, fontWeight: '700' },
  managerRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  manageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.indigo,
    borderRadius: 10,
    padding: 12,
  },
  manageButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

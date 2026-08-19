import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { checklistsApi, HttpError } from '../api/client';
import type { ChecklistItemStatus, ShiftChecklist } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import { NoteBox } from '../components/NoteBox';
import type { AppStackParamList } from '../navigation/types';

function ChecklistSection({
  title,
  icon,
  items,
  statuses,
  savingItem,
  onMark,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  statuses: ChecklistItemStatus[];
  savingItem: string | null;
  onMark: (item: string, done: boolean) => void;
}) {
  const answeredCount = items.filter((item) =>
    statuses.some((s) => s.item === item),
  ).length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={16} color={colors.text} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.length > 0 && (
          <Text style={styles.sectionProgress}>
            {answeredCount}/{items.length}
          </Text>
        )}
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>Nothing set for this position/branch yet</Text>
      ) : (
        items.map((item) => {
          const status = statuses.find((s) => s.item === item);
          const isSaving = savingItem === item;
          return (
            <View key={item} style={styles.itemRow}>
              <Text style={styles.itemText}>{item}</Text>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.itemButtons}>
                  <Pressable
                    style={[
                      styles.statusButton,
                      status?.done === true && styles.statusButtonDoneActive,
                    ]}
                    onPress={() => onMark(item, true)}
                  >
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={status?.done === true ? '#fff' : colors.success}
                    />
                    <Text
                      style={[
                        styles.statusButtonText,
                        status?.done === true && styles.statusButtonTextActive,
                      ]}
                    >
                      Done
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.statusButton,
                      status?.done === false && styles.statusButtonNotDoneActive,
                    ]}
                    onPress={() => onMark(item, false)}
                  >
                    <Ionicons
                      name="close"
                      size={14}
                      color={status?.done === false ? '#fff' : colors.danger}
                    />
                    <Text
                      style={[
                        styles.statusButtonText,
                        status?.done === false && styles.statusButtonTextActive,
                      ]}
                    >
                      Not Done
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

export default function ChecklistScreen() {
  const { authFetch } = useAuth();
  const route = useRoute<RouteProp<AppStackParamList, 'Checklist'>>();
  const { shiftId } = route.params;
  const [checklist, setChecklist] = useState<ShiftChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => checklistsApi.forShift(token, shiftId));
      setChecklist(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load checklist');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (section: 'opening' | 'closing', item: string, done: boolean) => {
    if (!checklist) return;
    const field = section === 'opening' ? 'openingStatuses' : 'closingStatuses';
    const current = checklist[field];
    const next = current.some((s) => s.item === item)
      ? current.map((s) => (s.item === item ? { item, done } : s))
      : [...current, { item, done }];

    setChecklist({ ...checklist, [field]: next });
    setSavingItem(item);
    setError(null);
    try {
      if (section === 'opening') {
        await authFetch((token) => checklistsApi.updateOpening(token, shiftId, item, done));
      } else {
        await authFetch((token) => checklistsApi.updateClosing(token, shiftId, item, done));
      }
    } catch (err) {
      setChecklist({ ...checklist, [field]: current });
      setError(err instanceof HttpError ? err.message : 'Could not save checklist');
    } finally {
      setSavingItem(null);
    }
  };

  if (isLoading || !checklist) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {checklist.title && <Text style={styles.checklistTitle}>{checklist.title}</Text>}

      {(checklist.position || checklist.jobSite) && (
        <View style={styles.headerRow}>
          {checklist.position && (
            <View style={[styles.positionBadge, { backgroundColor: `${POSITION_COLORS[checklist.position]}1a` }]}>
              <Ionicons
                name={POSITION_ICONS[checklist.position]}
                size={14}
                color={POSITION_COLORS[checklist.position]}
              />
              <Text style={[styles.positionBadgeText, { color: POSITION_COLORS[checklist.position] }]}>
                {POSITION_LABELS[checklist.position]}
              </Text>
            </View>
          )}
          {checklist.jobSite && (
            <View
              style={[
                styles.branchTag,
                { backgroundColor: `${colorForBranch(checklist.jobSite)}1a`, borderColor: colorForBranch(checklist.jobSite) },
              ]}
            >
              <Text style={[styles.branchTagText, { color: colorForBranch(checklist.jobSite) }]}>
                {checklist.jobSite}
              </Text>
            </View>
          )}
        </View>
      )}

      {!checklist.position && (
        <NoteBox variant="warning">
          This shift has no position set, so no checklist can be matched to it. Ask a manager
          to set one on this shift.
        </NoteBox>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <ChecklistSection
        title="Opening"
        icon="sunny-outline"
        items={checklist.openingItems}
        statuses={checklist.openingStatuses}
        savingItem={savingItem}
        onMark={(item, done) => mark('opening', item, done)}
      />

      <ChecklistSection
        title="Closing"
        icon="moon-outline"
        items={checklist.closingItems}
        statuses={checklist.closingStatuses}
        savingItem={savingItem}
        onMark={(item, done) => mark('closing', item, done)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
  checklistTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerRow: { flexDirection: 'row', gap: 8 },
  positionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  positionBadgeText: { fontSize: 12, fontWeight: '700' },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  branchTagText: { fontSize: 12, fontWeight: '700' },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    ...cardShadow,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  sectionProgress: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  empty: { fontSize: 13, color: colors.textFaint },
  itemRow: { gap: 8, paddingVertical: 6 },
  itemText: { fontSize: 15, color: colors.text },
  itemButtons: { flexDirection: 'row', gap: 8 },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusButtonDoneActive: { backgroundColor: colors.success, borderColor: colors.success },
  statusButtonNotDoneActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  statusButtonText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  statusButtonTextActive: { color: '#fff' },
});

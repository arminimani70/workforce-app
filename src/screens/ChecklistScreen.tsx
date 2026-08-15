import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { checklistsApi, HttpError } from '../api/client';
import type { ShiftChecklist } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import type { AppStackParamList } from '../navigation/types';

function ChecklistSection({
  title,
  icon,
  items,
  completedItems,
  savingItem,
  onToggle,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  completedItems: string[];
  savingItem: string | null;
  onToggle: (item: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={16} color={colors.text} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>Nothing set for this position/branch yet</Text>
      ) : (
        items.map((item) => {
          const isChecked = completedItems.includes(item);
          const isSaving = savingItem === item;
          return (
            <Pressable
              key={item}
              style={styles.itemRow}
              onPress={() => onToggle(item)}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={isChecked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isChecked ? colors.success : colors.textFaint}
                />
              )}
              <Text style={[styles.itemText, isChecked && styles.itemTextChecked]}>{item}</Text>
            </Pressable>
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

  const toggle = async (section: 'opening' | 'closing', item: string) => {
    if (!checklist) return;
    const field = section === 'opening' ? 'openingCompletedItems' : 'closingCompletedItems';
    const current = checklist[field];
    const next = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];

    setChecklist({ ...checklist, [field]: next });
    setSavingItem(item);
    setError(null);
    try {
      if (section === 'opening') {
        await authFetch((token) => checklistsApi.updateOpening(token, shiftId, next));
      } else {
        await authFetch((token) => checklistsApi.updateClosing(token, shiftId, next));
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

      {error && <Text style={styles.error}>{error}</Text>}

      <ChecklistSection
        title="Opening"
        icon="sunny-outline"
        items={checklist.openingItems}
        completedItems={checklist.openingCompletedItems}
        savingItem={savingItem}
        onToggle={(item) => toggle('opening', item)}
      />

      <ChecklistSection
        title="Closing"
        icon="moon-outline"
        items={checklist.closingItems}
        completedItems={checklist.closingCompletedItems}
        savingItem={savingItem}
        onToggle={(item) => toggle('closing', item)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
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
    gap: 4,
    ...cardShadow,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  empty: { fontSize: 13, color: colors.textFaint },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  itemText: { fontSize: 15, color: colors.text, flex: 1 },
  itemTextChecked: { color: colors.textFaint, textDecorationLine: 'line-through' },
});

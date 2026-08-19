import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { branchesApi, checklistsApi, HttpError } from '../api/client';
import { POSITIONS } from '../types/api';
import type { Branch, ChecklistItemStatus, LiveChecklist, Position } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import type { AppStackParamList } from '../navigation/types';

function ChecklistSection({
  title,
  icon,
  items,
  statuses,
  savingItem,
  isSubmitting,
  onMark,
  onSubmit,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  statuses: ChecklistItemStatus[];
  savingItem: string | null;
  isSubmitting: boolean;
  onMark: (item: string, done: boolean) => void;
  onSubmit: () => void;
}) {
  const answeredCount = items.filter((item) => statuses.some((s) => s.item === item)).length;
  const canSubmit = items.length > 0 && answeredCount === items.length;

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
        <>
          {items.map((item) => {
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
          })}

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={14} color="#fff" />
                <Text style={styles.submitButtonText}>Submit</Text>
              </>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function ChecklistScreen() {
  const { authFetch } = useAuth();
  const route = useRoute<RouteProp<AppStackParamList, 'Checklist'>>();
  const initial = route.params;

  const [position, setPosition] = useState<Position | null>(initial?.position ?? null);
  const [jobSite, setJobSite] = useState(initial?.jobSite ?? '');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [checklist, setChecklist] = useState<LiveChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [submittingSection, setSubmittingSection] = useState<'opening' | 'closing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    authFetch((token) => branchesApi.list(token))
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [authFetch]);

  const load = useCallback(
    async (forPosition: Position, forJobSite: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await authFetch((token) =>
          checklistsApi.current(token, forPosition, forJobSite),
        );
        setChecklist(result);
      } catch (err) {
        setError(err instanceof HttpError ? err.message : 'Could not load checklist');
      } finally {
        setIsLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (position) {
      load(position, jobSite);
    }
  }, [position, jobSite, load]);

  const mark = async (section: 'opening' | 'closing', item: string, done: boolean) => {
    if (!checklist || !position) return;
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
        await authFetch((token) => checklistsApi.updateOpening(token, position, jobSite, item, done));
      } else {
        await authFetch((token) => checklistsApi.updateClosing(token, position, jobSite, item, done));
      }
    } catch (err) {
      setChecklist({ ...checklist, [field]: current });
      setError(err instanceof HttpError ? err.message : 'Could not save checklist');
    } finally {
      setSavingItem(null);
    }
  };

  const submit = async (section: 'opening' | 'closing') => {
    if (!position) return;
    setSubmittingSection(section);
    setError(null);
    try {
      if (section === 'opening') {
        await authFetch((token) => checklistsApi.submitOpening(token, position, jobSite));
      } else {
        await authFetch((token) => checklistsApi.submitClosing(token, position, jobSite));
      }
      // The backend archives this section to history and resets it to blank — reload so the
      // form comes back empty, ready for whoever fills it next.
      await load(position, jobSite);
      setMessage(`${section === 'opening' ? 'Opening' : 'Closing'} checklist submitted`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not submit checklist');
    } finally {
      setSubmittingSection(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {message && (
        <View style={styles.messageBox}>
          <Ionicons name="checkmark-circle" size={16} color={colors.successText} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Position</Text>
      <View style={styles.chipsWrap}>
        {POSITIONS.map((p) => {
          const isActive = position === p;
          return (
            <Pressable
              key={p}
              style={[
                styles.chip,
                isActive && { backgroundColor: POSITION_COLORS[p], borderColor: POSITION_COLORS[p] },
              ]}
              onPress={() => setPosition(p)}
            >
              <Ionicons name={POSITION_ICONS[p]} size={14} color={isActive ? '#fff' : POSITION_COLORS[p]} />
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {POSITION_LABELS[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Branch (optional)</Text>
      <View style={styles.chipsWrap}>
        <Pressable
          style={[styles.chip, jobSite === '' && styles.chipActive]}
          onPress={() => setJobSite('')}
        >
          <Text style={[styles.chipText, jobSite === '' && styles.chipTextActive]}>All branches</Text>
        </Pressable>
        {branches.map((branch) => {
          const isActive = jobSite === branch.name;
          const color = colorForBranch(branch.name);
          return (
            <Pressable
              key={branch._id}
              style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
              onPress={() => setJobSite(branch.name)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{branch.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {!position ? (
        <Text style={styles.empty}>Pick a position to load the checklist</Text>
      ) : isLoading || !checklist ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          {checklist.title && <Text style={styles.checklistTitle}>{checklist.title}</Text>}

          <ChecklistSection
            title="Opening"
            icon="sunny-outline"
            items={checklist.openingItems}
            statuses={checklist.openingStatuses}
            savingItem={savingItem}
            isSubmitting={submittingSection === 'opening'}
            onMark={(item, done) => mark('opening', item, done)}
            onSubmit={() => submit('opening')}
          />

          <ChecklistSection
            title="Closing"
            icon="moon-outline"
            items={checklist.closingItems}
            statuses={checklist.closingStatuses}
            savingItem={savingItem}
            isSubmitting={submittingSection === 'closing'}
            onMark={(item, done) => mark('closing', item, done)}
            onSubmit={() => submit('closing')}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: colors.danger },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBg,
    borderRadius: 8,
    padding: 10,
  },
  messageText: { color: colors.successText, fontSize: 13, fontWeight: '600' },
  checklistTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

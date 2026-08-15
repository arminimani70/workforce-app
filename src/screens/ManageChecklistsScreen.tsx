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
import { useAuth } from '../auth/AuthContext';
import { checklistsApi, HttpError } from '../api/client';
import { POSITIONS } from '../types/api';
import type { ChecklistTemplate, Position } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import { NoteBox } from '../components/NoteBox';

export default function ManageChecklistsScreen() {
  const { authFetch } = useAuth();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [position, setPosition] = useState<Position | null>(null);
  const [jobSite, setJobSite] = useState('');
  const [openingItems, setOpeningItems] = useState<string[]>([]);
  const [closingItems, setClosingItems] = useState<string[]>([]);

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

  useEffect(() => {
    load();
  }, [load]);

  const editTemplate = (template: ChecklistTemplate) => {
    setPosition(template.position);
    setJobSite(template.jobSite);
    setOpeningItems(template.openingItems);
    setClosingItems(template.closingItems);
    setMessage(null);
    setError(null);
  };

  const startNew = (selectedPosition: Position) => {
    const existing = templates.find(
      (t) => t.position === selectedPosition && t.jobSite === jobSite.trim(),
    );
    setPosition(selectedPosition);
    setOpeningItems(existing?.openingItems ?? []);
    setClosingItems(existing?.closingItems ?? []);
    setMessage(null);
    setError(null);
  };

  const onJobSiteBlur = () => {
    if (!position) return;
    const existing = templates.find(
      (t) => t.position === position && t.jobSite === jobSite.trim(),
    );
    if (existing) {
      setOpeningItems(existing.openingItems);
      setClosingItems(existing.closingItems);
    }
  };

  const addItem = (section: 'opening' | 'closing') => {
    if (section === 'opening') setOpeningItems((prev) => [...prev, '']);
    else setClosingItems((prev) => [...prev, '']);
  };

  const updateItem = (section: 'opening' | 'closing', index: number, value: string) => {
    const setter = section === 'opening' ? setOpeningItems : setClosingItems;
    setter((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeItem = (section: 'opening' | 'closing', index: number) => {
    const setter = section === 'opening' ? setOpeningItems : setClosingItems;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    if (!position) {
      setError('Pick a position');
      return;
    }
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await authFetch((token) =>
        checklistsApi.upsertTemplate(token, {
          position,
          jobSite: jobSite.trim(),
          openingItems: openingItems.map((i) => i.trim()).filter(Boolean),
          closingItems: closingItems.map((i) => i.trim()).filter(Boolean),
        }),
      );
      setMessage('Saved');
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save checklist');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {templates.length > 0 && (
        <>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="list-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>Existing Checklists</Text>
          </View>
          {templates.map((template) => (
            <Pressable
              key={template._id}
              style={styles.templateRow}
              onPress={() => editTemplate(template)}
            >
              <Ionicons
                name={POSITION_ICONS[template.position]}
                size={16}
                color={POSITION_COLORS[template.position]}
              />
              <Text style={styles.templateText}>
                {POSITION_LABELS[template.position]} · {template.jobSite || 'All branches'}
              </Text>
              <Text style={styles.templateMeta}>
                {template.openingItems.length} opening · {template.closingItems.length} closing
              </Text>
            </Pressable>
          ))}
        </>
      )}

      <View style={styles.sectionTitleRow}>
        <Ionicons name="create-outline" size={16} color={colors.text} />
        <Text style={styles.sectionTitleDark}>
          {position ? 'Edit Checklist' : 'New Checklist'}
        </Text>
      </View>

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
              onPress={() => startNew(p)}
            >
              <Ionicons name={POSITION_ICONS[p]} size={14} color={isActive ? '#fff' : POSITION_COLORS[p]} />
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {POSITION_LABELS[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Branch (optional — leave blank for every branch)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Downtown — blank applies to shifts with no branch too"
        value={jobSite}
        onChangeText={setJobSite}
        onBlur={onJobSiteBlur}
      />
      {jobSite.trim() && (
        <View style={[styles.branchPreview, { borderColor: colorForBranch(jobSite.trim()) }]}>
          <Text style={[styles.branchPreviewText, { color: colorForBranch(jobSite.trim()) }]}>
            {jobSite.trim()}
          </Text>
        </View>
      )}

      {(['opening', 'closing'] as const).map((section) => {
        const items = section === 'opening' ? openingItems : closingItems;
        return (
          <View key={section} style={styles.itemsBox}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name={section === 'opening' ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.text} />
              <Text style={styles.sectionTitleDark}>
                {section === 'opening' ? 'Opening Items' : 'Closing Items'}
              </Text>
            </View>
            {items.map((item, index) => (
              <View key={index} style={styles.itemEditRow}>
                <TextInput
                  style={styles.itemInput}
                  placeholder="e.g. Turn on lights"
                  value={item}
                  onChangeText={(value) => updateItem(section, index, value)}
                />
                <Pressable onPress={() => removeItem(section, index)} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addItemButton} onPress={() => addItem(section)}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addItemButtonText}>Add item</Text>
            </Pressable>
          </View>
        );
      })}

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
            <Text style={styles.saveButtonText}>Save Checklist</Text>
          </>
        )}
      </Pressable>
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
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    ...cardShadow,
  },
  templateText: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  templateMeta: { fontSize: 12, color: colors.textMuted },
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
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  branchPreview: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  branchPreviewText: { fontSize: 12, fontWeight: '700' },
  itemsBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    ...cardShadow,
  },
  itemEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  addItemButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addItemButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary },
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
});

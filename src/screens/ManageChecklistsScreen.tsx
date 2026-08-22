import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { branchesApi, checklistsApi, HttpError } from '../api/client';
import { POSITIONS } from '../types/api';
import type { Branch, ChecklistTemplate, Position } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import { NoteBox } from '../components/NoteBox';
import type { AppStackParamList } from '../navigation/types';

export default function ManageChecklistsScreen() {
  const { authFetch } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [position, setPosition] = useState<Position | null>(null);
  const [jobSite, setJobSite] = useState('');
  const [title, setTitle] = useState('');
  const [openingItems, setOpeningItems] = useState<string[]>([]);
  const [closingItems, setClosingItems] = useState<string[]>([]);
  const [allowPhoto, setAllowPhoto] = useState(false);

  const load = useCallback(async () => {
    try {
      const [result, orgBranches] = await Promise.all([
        authFetch((token) => checklistsApi.listTemplates(token)),
        authFetch((token) => branchesApi.list(token)),
      ]);
      setTemplates(result);
      setBranches(orgBranches);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load checklists');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const applyExisting = (targetPosition: Position, targetJobSite: string) => {
    const existing = templates.find(
      (t) => t.position === targetPosition && t.jobSite === targetJobSite,
    );
    setTitle(existing?.title ?? '');
    setOpeningItems(existing?.openingItems ?? []);
    setClosingItems(existing?.closingItems ?? []);
    setAllowPhoto(existing?.allowPhoto ?? false);
  };

  const editTemplate = (template: ChecklistTemplate) => {
    setPosition(template.position);
    setJobSite(template.jobSite);
    setTitle(template.title);
    setOpeningItems(template.openingItems);
    setClosingItems(template.closingItems);
    setAllowPhoto(template.allowPhoto);
    setMessage(null);
    setError(null);
  };

  const startNew = (selectedPosition: Position) => {
    setPosition(selectedPosition);
    applyExisting(selectedPosition, jobSite);
    setMessage(null);
    setError(null);
  };

  const clearForm = () => {
    setPosition(null);
    setJobSite('');
    setTitle('');
    setOpeningItems([]);
    setClosingItems([]);
    setAllowPhoto(false);
  };

  const onDelete = async (template: ChecklistTemplate) => {
    setError(null);
    setDeletingId(template._id);
    try {
      await authFetch((token) => checklistsApi.deleteTemplate(token, template._id));
      if (position === template.position && jobSite === template.jobSite) {
        clearForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not delete checklist');
    } finally {
      setDeletingId(null);
    }
  };

  const selectJobSite = (value: string) => {
    setJobSite(value);
    if (position) applyExisting(position, value);
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
          title: title.trim(),
          openingItems: openingItems.map((i) => i.trim()).filter(Boolean),
          closingItems: closingItems.map((i) => i.trim()).filter(Boolean),
          allowPhoto,
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Pressable
        style={styles.submissionsButton}
        onPress={() => navigation.navigate('ChecklistSubmissions')}
      >
        <Ionicons name="time-outline" size={16} color="#fff" />
        <Text style={styles.submissionsButtonText}>View Submissions</Text>
      </Pressable>

      {templates.length > 0 && (
        <>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="list-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>Existing Checklists</Text>
          </View>
          {templates.map((template) => (
            <View key={template._id} style={styles.templateRow}>
              <Pressable style={styles.templateInfo} onPress={() => editTemplate(template)}>
                <Ionicons
                  name={POSITION_ICONS[template.position]}
                  size={16}
                  color={POSITION_COLORS[template.position]}
                />
                <View style={styles.templateTextGroup}>
                  <Text style={styles.templateText}>
                    {template.title || `${POSITION_LABELS[template.position]} · ${template.jobSite || 'All branches'}`}
                  </Text>
                  {template.title && (
                    <Text style={styles.templateSubtext}>
                      {POSITION_LABELS[template.position]} · {template.jobSite || 'All branches'}
                    </Text>
                  )}
                </View>
                <Text style={styles.templateMeta}>
                  {template.openingItems.length} opening · {template.closingItems.length} closing
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(template)}
                disabled={deletingId === template._id}
                hitSlop={8}
              >
                {deletingId === template._id ? (
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
      <View style={styles.chipsWrap}>
        <Pressable
          style={[styles.chip, jobSite === '' && styles.chipActive]}
          onPress={() => selectJobSite('')}
        >
          <Text style={[styles.chipText, jobSite === '' && styles.chipTextActive]}>
            All branches
          </Text>
        </Pressable>
        {branches.map((branch) => {
          const isActive = jobSite === branch.name;
          const color = colorForBranch(branch.name);
          return (
            <Pressable
              key={branch._id}
              style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
              onPress={() => selectJobSite(branch.name)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {branch.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {branches.length === 0 && (
        <Text style={styles.noBranchesText}>
          No branches yet — add one from Schedule &gt; Manage Branches
        </Text>
      )}

      <Text style={styles.sectionLabel}>Title (optional heading shown on the checklist)</Text>
      <TextInput
        style={styles.itemInput}
        placeholder="e.g. Morning Opening — Front Desk"
        value={title}
        onChangeText={setTitle}
      />

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

      <View style={styles.photoToggleRow}>
        <View style={styles.photoToggleTextGroup}>
          <Text style={styles.sectionTitleDark}>Allow photo attachments</Text>
          <Text style={styles.photoToggleSubtext}>
            Employees can take a live camera photo to prove an item is done
          </Text>
        </View>
        <Switch value={allowPhoto} onValueChange={setAllowPhoto} />
      </View>

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
  templateInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  templateTextGroup: { flex: 1 },
  templateText: { fontSize: 14, fontWeight: '600', color: colors.text },
  templateSubtext: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
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
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  noBranchesText: { fontSize: 13, color: colors.textFaint },
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
  photoToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    ...cardShadow,
  },
  photoToggleTextGroup: { flex: 1, gap: 2 },
  photoToggleSubtext: { fontSize: 12, color: colors.textMuted },
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
  submissionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.indigo,
    borderRadius: 10,
    padding: 12,
  },
  submissionsButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

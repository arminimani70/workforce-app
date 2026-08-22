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
import { branchesApi, stockApi, HttpError } from '../api/client';
import type { Branch, StockItem, StockTemplate } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { NoteBox } from '../components/NoteBox';

function emptyItem(): StockItem {
  return { productName: '', unit: '' };
}

export default function ManageStockScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState<StockTemplate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [jobSite, setJobSite] = useState('');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<StockItem[]>([emptyItem()]);

  const load = useCallback(async () => {
    try {
      const [result, orgBranches] = await Promise.all([
        authFetch((token) => stockApi.listTemplates(token)),
        authFetch((token) => branchesApi.list(token)),
      ]);
      setTemplates(result);
      setBranches(orgBranches);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load stock lists');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditingId(null);
    setJobSite(branches[0]?.name ?? '');
    setTitle('');
    setItems([emptyItem()]);
    setMessage(null);
    setError(null);
  };

  const editTemplate = (template: StockTemplate) => {
    setEditingId(template._id);
    setJobSite(template.jobSite);
    setTitle(template.title);
    setItems(template.items.map((i) => ({ ...i })));
    setMessage(null);
    setError(null);
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const updateItem = (index: number, field: keyof StockItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    if (!jobSite.trim()) {
      setError('Pick a branch');
      return;
    }
    if (!title.trim()) {
      setError('Give the list a title');
      return;
    }
    const cleanItems = items
      .map((i) => ({ productName: i.productName.trim(), unit: i.unit.trim() }))
      .filter((i) => i.productName && i.unit);
    if (cleanItems.length === 0) {
      setError('Add at least one product with a unit');
      return;
    }
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await authFetch((token) =>
        stockApi.upsertTemplate(token, {
          id: editingId ?? undefined,
          jobSite: jobSite.trim(),
          title: title.trim(),
          items: cleanItems,
        }),
      );
      setMessage('Saved');
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save stock list');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      await authFetch((token) => stockApi.deleteTemplate(token, id));
      if (editingId === id) startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not delete stock list');
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
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {branches.length === 0 && (
        <NoteBox variant="warning">
          No branches yet — add one from Schedule &gt; Manage Branches before building a stock
          list.
        </NoteBox>
      )}

      {templates.length > 0 && (
        <>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="list-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>Existing Lists</Text>
          </View>
          {templates.map((template) => (
            <View key={template._id} style={styles.templateRow}>
              <Pressable style={styles.templateInfo} onPress={() => editTemplate(template)}>
                <Ionicons name="cube-outline" size={16} color={colors.primary} />
                <View style={styles.templateTextGroup}>
                  <Text style={styles.templateText}>{template.title}</Text>
                  <Text style={styles.templateMeta}>{template.items.length} products</Text>
                </View>
              </Pressable>
              <View
                style={[
                  styles.branchTag,
                  { backgroundColor: `${colorForBranch(template.jobSite)}1a`, borderColor: colorForBranch(template.jobSite) },
                ]}
              >
                <Text style={[styles.branchTagText, { color: colorForBranch(template.jobSite) }]}>
                  {template.jobSite}
                </Text>
              </View>
              <Pressable
                onPress={() => onDelete(template._id)}
                disabled={deletingId === template._id}
                hitSlop={8}
              >
                {deletingId === template._id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                )}
              </Pressable>
            </View>
          ))}
        </>
      )}

      <View style={styles.sectionTitleRow}>
        <Ionicons name="create-outline" size={16} color={colors.text} />
        <Text style={styles.sectionTitleDark}>{editingId ? 'Edit List' : 'New List'}</Text>
      </View>

      <Text style={styles.sectionLabel}>Branch</Text>
      <View style={styles.chipsWrap}>
        {branches.map((branch) => {
          const isActive = jobSite === branch.name;
          const color = colorForBranch(branch.name);
          return (
            <Pressable
              key={branch._id}
              style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
              onPress={() => setJobSite(branch.name)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {branch.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        placeholder="List title, e.g. Bar Stock"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.sectionLabel}>Products</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <TextInput
            style={styles.itemInput}
            placeholder="Product name"
            value={item.productName}
            onChangeText={(value) => updateItem(index, 'productName', value)}
          />
          <TextInput
            style={styles.unitInput}
            placeholder="Unit"
            value={item.unit}
            onChangeText={(value) => updateItem(index, 'unit', value)}
          />
          <Pressable onPress={() => removeItem(index)} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addItemButton} onPress={addItem}>
        <Ionicons name="add" size={16} color={colors.primary} />
        <Text style={styles.addItemButtonText}>Add product</Text>
      </Pressable>

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
            <Text style={styles.saveButtonText}>{editingId ? 'Save Changes' : 'Create List'}</Text>
          </>
        )}
      </Pressable>

      {editingId && (
        <Pressable style={styles.cancelButton} onPress={startNew}>
          <Text style={styles.cancelButtonText}>Cancel editing, start a new list</Text>
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
  templateMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  branchTagText: { fontSize: 12, fontWeight: '700' },
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
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  unitInput: {
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
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 13 },
});

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
import { formsApi, HttpError } from '../api/client';
import type { FormField, FormFieldType, FormTemplate } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { NoteBox } from '../components/NoteBox';

function emptyField(): FormField {
  return { label: '', type: 'text' };
}

export default function ManageFormsScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<FormField[]>([emptyField()]);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => formsApi.listTemplates(token));
      setTemplates(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load forms');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditingId(null);
    setTitle('');
    setFields([emptyField()]);
    setMessage(null);
    setError(null);
  };

  const editTemplate = (template: FormTemplate) => {
    setEditingId(template._id);
    setTitle(template.title);
    setFields(template.fields.map((f) => ({ ...f })));
    setMessage(null);
    setError(null);
  };

  const addField = () => setFields((prev) => [...prev, emptyField()]);

  const updateFieldLabel = (index: number, label: string) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, label } : f)));
  };

  const setFieldType = (index: number, type: FormFieldType) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, type } : f)));
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    if (!title.trim()) {
      setError('Give the form a title');
      return;
    }
    const cleanFields = fields
      .map((f) => ({ ...f, label: f.label.trim() }))
      .filter((f) => f.label);
    if (cleanFields.length === 0) {
      setError('Add at least one field');
      return;
    }
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await authFetch((token) =>
        formsApi.upsertTemplate(token, {
          id: editingId ?? undefined,
          title: title.trim(),
          fields: cleanFields,
        }),
      );
      setMessage('Saved');
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save form');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      await authFetch((token) => formsApi.deleteTemplate(token, id));
      if (editingId === id) startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not delete form');
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
    >
      {templates.length > 0 && (
        <>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="list-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>Existing Forms</Text>
          </View>
          {templates.map((template) => (
            <View key={template._id} style={styles.templateRow}>
              <Pressable style={styles.templateInfo} onPress={() => editTemplate(template)}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={styles.templateText}>{template.title}</Text>
                <Text style={styles.templateMeta}>{template.fields.length} fields</Text>
              </Pressable>
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
        <Text style={styles.sectionTitleDark}>{editingId ? 'Edit Form' : 'New Form'}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Title, e.g. Damaged Product"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.sectionLabel}>Fields</Text>
      {fields.map((field, index) => (
        <View key={index} style={styles.fieldRow}>
          <TextInput
            style={styles.fieldInput}
            placeholder="Field label, e.g. Product name"
            value={field.label}
            onChangeText={(value) => updateFieldLabel(index, value)}
          />
          <View style={styles.typeChips}>
            {(['text', 'number'] as FormFieldType[]).map((type) => {
              const isActive = field.type === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.typeChip, isActive && styles.typeChipActive]}
                  onPress={() => setFieldType(index, type)}
                >
                  <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                    {type === 'text' ? 'Text' : 'Number'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => removeField(index)} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addFieldButton} onPress={addField}>
        <Ionicons name="add" size={16} color={colors.primary} />
        <Text style={styles.addFieldButtonText}>Add field</Text>
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
            <Text style={styles.saveButtonText}>{editingId ? 'Save Changes' : 'Create Form'}</Text>
          </>
        )}
      </Pressable>

      {editingId && (
        <Pressable style={styles.cancelButton} onPress={startNew}>
          <Text style={styles.cancelButtonText}>Cancel editing, start a new form</Text>
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
  templateText: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  templateMeta: { fontSize: 12, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  typeChips: { flexDirection: 'row', gap: 4 },
  typeChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 12, color: '#333' },
  typeChipTextActive: { color: '#fff' },
  addFieldButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addFieldButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary },
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

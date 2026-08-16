import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { formsApi, HttpError } from '../api/client';
import type { FormTemplate } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { PopupModal } from '../components/PopupModal';
import type { AppStackParamList } from '../navigation/types';

export default function FormsScreen() {
  const { user, authFetch } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

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

  const openForm = (template: FormTemplate) => {
    setActiveTemplate(template);
    setValues({});
    setError(null);
  };

  const onSubmit = async () => {
    if (!activeTemplate) return;
    const missing = activeTemplate.fields.some((_, index) => !values[index]?.trim());
    if (missing) {
      setError('Fill in every field');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authFetch((token) =>
        formsApi.submit(token, {
          formTemplateId: activeTemplate._id,
          values: activeTemplate.fields.map((field, index) => ({
            label: field.label,
            value: values[index].trim(),
          })),
        }),
      );
      setActiveTemplate(null);
      setMessage(`"${activeTemplate.title}" submitted`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not submit form');
    } finally {
      setIsSubmitting(false);
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
    <View style={styles.container}>
      {message && (
        <View style={styles.messageBox}>
          <Ionicons name="checkmark-circle" size={16} color={colors.successText} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}
      {error && !activeTemplate && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={templates}
        keyExtractor={(item) => item._id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="document-text-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No forms have been set up yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.formRow} onPress={() => openForm(item)}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <View style={styles.formTextGroup}>
              <Text style={styles.formTitle}>{item.title}</Text>
              <Text style={styles.formMeta}>{item.fields.length} fields</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      />

      {canManage && (
        <View style={styles.managerRow}>
          <Pressable
            style={styles.manageButton}
            onPress={() => navigation.navigate('ManageForms')}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Manage Forms</Text>
          </Pressable>
          <Pressable
            style={styles.manageButton}
            onPress={() => navigation.navigate('FormSubmissions')}
          >
            <Ionicons name="time-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Submission History</Text>
          </Pressable>
        </View>
      )}

      <PopupModal visible={activeTemplate !== null} onClose={() => setActiveTemplate(null)}>
        <View style={styles.modalCard}>
          <Text style={styles.formModalTitle}>{activeTemplate?.title}</Text>
          {activeTemplate?.fields.map((field, index) => (
            <View key={index}>
              <Text style={styles.sectionLabel}>{field.label}</Text>
              <TextInput
                style={styles.input}
                value={values[index] ?? ''}
                onChangeText={(text) => setValues((prev) => ({ ...prev, [index]: text }))}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              />
            </View>
          ))}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Submit</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.cancelButton} onPress={() => setActiveTemplate(null)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </PopupModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, marginBottom: 8 },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  messageText: { color: colors.successText, fontSize: 13, fontWeight: '600' },
  list: { flex: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  empty: { fontSize: 13, color: colors.textFaint },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...cardShadow,
  },
  formTextGroup: { flex: 1 },
  formTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  formMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
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
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  formModalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
  },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 14 },
});

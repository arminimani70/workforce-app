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
import { HttpError, onboardingApi } from '../api/client';
import { cardShadow, colors } from '../theme/colors';

export default function OnboardingScreen() {
  const { user, authFetch } = useAuth();
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const guide = await authFetch((token) => onboardingApi.get(token));
      setContent(guide.content);
      setUpdatedAt(guide.updatedAt);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load the onboarding guide');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const onStartEdit = () => {
    setDraft(content);
    setError(null);
    setIsEditing(true);
  };

  const onCancelEdit = () => {
    setIsEditing(false);
  };

  const onSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const guide = await authFetch((token) => onboardingApi.update(token, draft));
      setContent(guide.content);
      setUpdatedAt(guide.updatedAt);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save the onboarding guide');
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
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="school-outline" size={18} color={colors.indigo} />
          <Text style={styles.title}>Onboarding Guide</Text>
        </View>
        {canManage && !isEditing && (
          <Pressable style={styles.editButton} onPress={onStartEdit}>
            <Ionicons name="pencil-outline" size={16} color={colors.indigo} />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {updatedAt && !isEditing && (
        <Text style={styles.updatedText}>
          Last updated {new Date(updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {isEditing ? (
        <View style={styles.editBox}>
          <TextInput
            style={styles.editInput}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder="Welcome new hires! Cover the rules, dress code, how to clock in, who to ask for help…"
            textAlignVertical="top"
          />
          <View style={styles.editActions}>
            <Pressable style={styles.cancelButton} onPress={onCancelEdit} disabled={isSaving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={onSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : content ? (
        <View style={styles.contentBox}>
          <Text style={styles.contentText}>{content}</Text>
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="book-outline" size={28} color={colors.textFaint} />
          <Text style={styles.emptyText}>No onboarding guide yet</Text>
          {canManage && (
            <Text style={styles.emptySubtext}>Tap Edit to write one for new hires</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.indigo,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  editButtonText: { color: colors.indigo, fontSize: 13, fontWeight: '600' },
  updatedText: { fontSize: 12, color: colors.textFaint, marginTop: -4 },
  error: { color: colors.danger },
  contentBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    ...cardShadow,
  },
  contentText: { fontSize: 15, lineHeight: 22, color: colors.text },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 6,
    ...cardShadow,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 13, color: colors.textFaint },
  editBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    ...cardShadow,
  },
  editInput: {
    minHeight: 220,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    padding: 8,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.indigo,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

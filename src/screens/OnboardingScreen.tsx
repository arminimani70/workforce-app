import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { OnboardingSection } from '../types/api';
import { cardShadow, colors } from '../theme/colors';

function emptySection(): OnboardingSection {
  return { title: '', content: '' };
}

export default function OnboardingScreen() {
  const { user, authFetch } = useAuth();
  const [sections, setSections] = useState<OnboardingSection[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<OnboardingSection[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const guide = await authFetch((token) => onboardingApi.get(token));
      setSections(guide.sections);
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

  const visibleSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sections;
    return sections.filter(
      (s) => s.title.toLowerCase().includes(query) || s.content.toLowerCase().includes(query),
    );
  }, [sections, search]);

  const onStartEdit = () => {
    setDraft(sections.length > 0 ? sections.map((s) => ({ ...s })) : [emptySection()]);
    setError(null);
    setIsEditing(true);
  };

  const onCancelEdit = () => {
    setIsEditing(false);
  };

  const addSection = () => setDraft((prev) => [...prev, emptySection()]);

  const updateSectionTitle = (index: number, title: string) => {
    setDraft((prev) => prev.map((s, i) => (i === index ? { ...s, title } : s)));
  };

  const updateSectionContent = (index: number, content: string) => {
    setDraft((prev) => prev.map((s, i) => (i === index ? { ...s, content } : s)));
  };

  const removeSection = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    const cleaned = draft
      .map((s) => ({ title: s.title.trim(), content: s.content.trim() }))
      .filter((s) => s.title);
    setError(null);
    setIsSaving(true);
    try {
      const guide = await authFetch((token) => onboardingApi.update(token, cleaned));
      setSections(guide.sections);
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
          {draft.map((section, index) => (
            <View key={index} style={styles.editSectionBox}>
              <View style={styles.editSectionHeaderRow}>
                <TextInput
                  style={styles.titleInput}
                  value={section.title}
                  onChangeText={(value) => updateSectionTitle(index, value)}
                  placeholder="Section title, e.g. Dress Code"
                />
                <Pressable onPress={() => removeSection(index)} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </Pressable>
              </View>
              <TextInput
                style={styles.editInput}
                multiline
                value={section.content}
                onChangeText={(value) => updateSectionContent(index, value)}
                placeholder="What new hires need to know about this…"
                textAlignVertical="top"
              />
            </View>
          ))}

          <Pressable style={styles.addSectionButton} onPress={addSection}>
            <Ionicons name="add" size={16} color={colors.indigo} />
            <Text style={styles.addSectionButtonText}>Add section</Text>
          </Pressable>

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
      ) : sections.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="book-outline" size={28} color={colors.textFaint} />
          <Text style={styles.emptyText}>No onboarding guide yet</Text>
          {canManage && (
            <Text style={styles.emptySubtext}>Tap Edit to write one for new hires</Text>
          )}
        </View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textFaint} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by title…"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          {visibleSections.length === 0 ? (
            <Text style={styles.noResults}>No sections match "{search}"</Text>
          ) : (
            visibleSections.map((section) => {
              const isOpen = expandedTitle === section.title;
              return (
                <Pressable
                  key={section.title}
                  style={styles.sectionCard}
                  onPress={() => setExpandedTitle(isOpen ? null : section.title)}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionCardTitle}>{section.title}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textFaint}
                    />
                  </View>
                  {isOpen && <Text style={styles.sectionCardContent}>{section.content}</Text>}
                </Pressable>
              );
            })
          )}
        </>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...cardShadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  noResults: { fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: 12 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    ...cardShadow,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  sectionCardContent: { fontSize: 14, lineHeight: 21, color: colors.text, marginTop: 10 },
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
  editBox: { gap: 10 },
  editSectionBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    ...cardShadow,
  },
  editSectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 4,
  },
  editInput: {
    minHeight: 100,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  addSectionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  addSectionButtonText: { fontSize: 13, fontWeight: '600', color: colors.indigo },
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

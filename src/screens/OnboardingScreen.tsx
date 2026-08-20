import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useAuth } from '../auth/AuthContext';
import { HttpError, onboardingApi } from '../api/client';
import type { OnboardingResource, OnboardingSection } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { ATTACHMENT_DOCUMENT_TYPES, formatFileSize, iconForMimeType } from '../utils/files';
import type { AppStackParamList } from '../navigation/types';

function emptySection(): OnboardingSection {
  return { title: '', content: '' };
}

export default function OnboardingScreen() {
  const { user, authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [sections, setSections] = useState<OnboardingSection[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<OnboardingSection[]>([]);
  const [draftRules, setDraftRules] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);

  const [resources, setResources] = useState<OnboardingResource[]>([]);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const [guide, resourceList] = await Promise.all([
        authFetch((token) => onboardingApi.get(token)),
        authFetch((token) => onboardingApi.listResources(token)),
      ]);
      setSections(guide.sections ?? []);
      setRules(guide.rules ?? []);
      setUpdatedAt(guide.updatedAt);
      setResources(resourceList);
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
    setDraftRules(rules.length > 0 ? [...rules] : ['']);
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

  const addRule = () => setDraftRules((prev) => [...prev, '']);

  const updateRule = (index: number, value: string) => {
    setDraftRules((prev) => prev.map((r, i) => (i === index ? value : r)));
  };

  const removeRule = (index: number) => {
    setDraftRules((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    const cleanedSections = draft
      .map((s) => ({ title: s.title.trim(), content: s.content.trim() }))
      .filter((s) => s.title);
    const cleanedRules = draftRules.map((r) => r.trim()).filter(Boolean);
    setError(null);
    setIsSaving(true);
    try {
      const guide = await authFetch((token) =>
        onboardingApi.update(token, cleanedSections, cleanedRules),
      );
      setSections(guide.sections);
      setRules(guide.rules);
      setUpdatedAt(guide.updatedAt);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save the onboarding guide');
    } finally {
      setIsSaving(false);
    }
  };

  const onPickAndUpload = async () => {
    setResourcesError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ATTACHMENT_DOCUMENT_TYPES,
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      setIsUploading(true);
      const uploaded = await authFetch((token) =>
        onboardingApi.uploadResource(
          token,
          {
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType ?? 'application/octet-stream',
          },
          asset.name,
        ),
      );
      setResources((prev) => [uploaded, ...prev]);
    } catch (err) {
      setResourcesError(err instanceof HttpError ? err.message : 'Could not upload the file');
    } finally {
      setIsUploading(false);
    }
  };

  const onDeleteResource = (id: string, title: string) => {
    Alert.alert('Delete file', `Remove "${title}" from onboarding?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setResourcesError(null);
          try {
            await authFetch((token) => onboardingApi.deleteResource(token, id));
            setResources((prev) => prev.filter((r) => r._id !== id));
          } catch (err) {
            setResourcesError(err instanceof HttpError ? err.message : 'Could not delete the file');
          }
        },
      },
    ]);
  };

  const onOpenResource = async (resource: OnboardingResource) => {
    setResourcesError(null);
    setDownloadingId(resource._id);
    try {
      const uri = await authFetch(async (token) => {
        const file = await File.downloadFileAsync(
          onboardingApi.resourceDownloadUrl(resource._id),
          Paths.cache,
          { headers: { Authorization: `Bearer ${token}` }, idempotent: true },
        );
        return file.uri;
      });
      navigation.navigate('DocumentViewer', {
        uri,
        title: resource.title,
        mimeType: resource.mimeType,
      });
    } catch {
      setResourcesError('Could not open the file');
    } finally {
      setDownloadingId(null);
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
          <Text style={styles.subheading}>Daily Rules</Text>
          {draftRules.map((rule, index) => (
            <View key={index} style={styles.ruleEditRow}>
              <TextInput
                style={styles.ruleInput}
                value={rule}
                onChangeText={(value) => updateRule(index, value)}
                placeholder="e.g. Clock in before your shift starts"
              />
              <Pressable onPress={() => removeRule(index)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addSectionButton} onPress={addRule}>
            <Ionicons name="add" size={16} color={colors.indigo} />
            <Text style={styles.addSectionButtonText}>Add rule</Text>
          </Pressable>

          <Text style={[styles.subheading, styles.sectionsHeading]}>Sections</Text>
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
      ) : (
        <>
          {rules.length > 0 && (
            <View style={styles.rulesBox}>
              <View style={styles.headerLeft}>
                <Ionicons name="checkmark-done-outline" size={16} color={colors.indigo} />
                <Text style={styles.subheading}>Daily Rules</Text>
              </View>
              {rules.map((rule, index) => (
                <View key={index} style={styles.ruleRow}>
                  <Ionicons name="ellipse" size={6} color={colors.textFaint} style={styles.ruleBullet} />
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.resourcesBox}>
            <View style={styles.resourcesHeaderRow}>
              <View style={styles.headerLeft}>
                <Ionicons name="folder-outline" size={16} color={colors.teal} />
                <Text style={styles.subheading}>Training Materials</Text>
              </View>
              {canManage && (
                <Pressable style={styles.uploadButton} onPress={onPickAndUpload} disabled={isUploading}>
                  {isUploading ? (
                    <ActivityIndicator size="small" color={colors.teal} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color={colors.teal} />
                      <Text style={styles.uploadButtonText}>Upload</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {resourcesError && <Text style={styles.error}>{resourcesError}</Text>}

            {resources.length === 0 ? (
              <Text style={styles.emptyInlineText}>No training materials yet</Text>
            ) : (
              resources.map((resource) => (
                <View key={resource._id} style={styles.resourceRow}>
                  <Pressable
                    style={styles.resourceMain}
                    onPress={() => onOpenResource(resource)}
                    disabled={downloadingId === resource._id}
                  >
                    <Ionicons name={iconForMimeType(resource.mimeType)} size={20} color={colors.teal} />
                    <View style={styles.resourceInfo}>
                      <Text style={styles.resourceTitle} numberOfLines={1}>
                        {resource.title}
                      </Text>
                      <Text style={styles.resourceMeta}>
                        {formatFileSize(resource.size)} · {resource.uploadedBy.fullName}
                      </Text>
                    </View>
                    {downloadingId === resource._id && (
                      <ActivityIndicator size="small" color={colors.teal} />
                    )}
                  </Pressable>
                  {canManage && (
                    <Pressable onPress={() => onDeleteResource(resource._id, resource.title)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>

          {sections.length === 0 ? (
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
  subheading: { fontSize: 14, fontWeight: '700', color: colors.text },
  sectionsHeading: { marginTop: 6 },
  rulesBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    ...cardShadow,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleBullet: { marginTop: 7 },
  ruleText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  ruleEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
  },
  resourcesBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    ...cardShadow,
  },
  resourcesHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  uploadButtonText: { color: colors.teal, fontSize: 13, fontWeight: '600' },
  emptyInlineText: { fontSize: 13, color: colors.textFaint },
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resourceMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resourceInfo: { flex: 1 },
  resourceTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  resourceMeta: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
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

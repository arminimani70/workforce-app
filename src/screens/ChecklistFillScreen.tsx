import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { checklistsApi, HttpError } from '../api/client';
import type { ChecklistItemStatus, LiveChecklist } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';
import type { AppStackParamList } from '../navigation/types';

type Section = 'opening' | 'closing';

function ChecklistItemRow({
  item,
  status,
  isSaving,
  isUploadingPhoto,
  onMark,
  onPhoto,
}: {
  item: string;
  status?: ChecklistItemStatus;
  isSaving: boolean;
  isUploadingPhoto: boolean;
  onMark: (done: boolean) => void;
  onPhoto: (fromCamera: boolean) => void;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemTopRow}>
        <Text style={styles.itemText}>{item}</Text>
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.itemButtons}>
            <Pressable
              style={[styles.statusButton, status?.done === true && styles.statusButtonDoneActive]}
              onPress={() => onMark(true)}
            >
              <Ionicons name="checkmark" size={14} color={status?.done === true ? '#fff' : colors.success} />
              <Text style={[styles.statusButtonText, status?.done === true && styles.statusButtonTextActive]}>
                Done
              </Text>
            </Pressable>
            <Pressable
              style={[styles.statusButton, status?.done === false && styles.statusButtonNotDoneActive]}
              onPress={() => onMark(false)}
            >
              <Ionicons name="close" size={14} color={status?.done === false ? '#fff' : colors.danger} />
              <Text style={[styles.statusButtonText, status?.done === false && styles.statusButtonTextActive]}>
                Not Done
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {status && (
        <View style={styles.photoRow}>
          {isUploadingPhoto ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : status.photoUrl ? (
            <Pressable onPress={() => onPhoto(false)}>
              <Image source={{ uri: status.photoUrl }} style={styles.photoThumb} />
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.photoButton} onPress={() => onPhoto(true)}>
                <Ionicons name="camera-outline" size={14} color={colors.primary} />
                <Text style={styles.photoButtonText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.photoButton} onPress={() => onPhoto(false)}>
                <Ionicons name="image-outline" size={14} color={colors.primary} />
                <Text style={styles.photoButtonText}>Photo</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function ChecklistFillSection({
  section,
  title,
  icon,
  items,
  statuses,
  savingKey,
  uploadingKey,
  isSubmitting,
  onMark,
  onPhoto,
  onSubmit,
}: {
  section: Section;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  statuses: ChecklistItemStatus[];
  savingKey: string | null;
  uploadingKey: string | null;
  isSubmitting: boolean;
  onMark: (item: string, done: boolean) => void;
  onPhoto: (item: string, fromCamera: boolean) => void;
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
        <Text style={styles.empty}>Nothing set for this checklist yet</Text>
      ) : (
        <>
          {items.map((item) => (
            <ChecklistItemRow
              key={item}
              item={item}
              status={statuses.find((s) => s.item === item)}
              isSaving={savingKey === `${section}:${item}`}
              isUploadingPhoto={uploadingKey === `${section}:${item}`}
              onMark={(done) => onMark(item, done)}
              onPhoto={(fromCamera) => onPhoto(item, fromCamera)}
            />
          ))}

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

export default function ChecklistFillScreen() {
  const { authFetch } = useAuth();
  const route = useRoute<RouteProp<AppStackParamList, 'ChecklistFill'>>();
  const { position, jobSite, title } = route.params;

  const [checklist, setChecklist] = useState<LiveChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submittingSection, setSubmittingSection] = useState<Section | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authFetch((token) => checklistsApi.current(token, position, jobSite));
      setChecklist(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load checklist');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, position, jobSite]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (section: Section, item: string, done: boolean) => {
    if (!checklist) return;
    const field = section === 'opening' ? 'openingStatuses' : 'closingStatuses';
    const current = checklist[field];
    const existing = current.find((s) => s.item === item);
    const next = existing
      ? current.map((s) => (s.item === item ? { ...s, done } : s))
      : [...current, { item, done }];

    setChecklist({ ...checklist, [field]: next });
    setSavingKey(`${section}:${item}`);
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
      setSavingKey(null);
    }
  };

  const attachPhoto = async (section: Section, item: string, fromCamera: boolean) => {
    if (!checklist) return;
    const field = section === 'opening' ? 'openingStatuses' : 'closingStatuses';
    const status = checklist[field].find((s) => s.item === item);
    if (!status) return;

    setError(null);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Permission denied');
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || result.assets.length === 0) return;

      setUploadingKey(`${section}:${item}`);
      const manipulated = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.5, format: SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        setError('Could not process the image');
        return;
      }
      const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;

      const updated =
        section === 'opening'
          ? await authFetch((token) =>
              checklistsApi.updateOpening(token, position, jobSite, item, status.done, dataUri),
            )
          : await authFetch((token) =>
              checklistsApi.updateClosing(token, position, jobSite, item, status.done, dataUri),
            );
      void updated;

      setChecklist((prev) =>
        prev
          ? {
              ...prev,
              [field]: prev[field].map((s) => (s.item === item ? { ...s, photoUrl: dataUri } : s)),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not attach photo');
    } finally {
      setUploadingKey(null);
    }
  };

  const submit = async (section: Section) => {
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
      await load();
      setMessage(`${section === 'opening' ? 'Opening' : 'Closing'} checklist submitted`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not submit checklist');
    } finally {
      setSubmittingSection(null);
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
      {message && (
        <View style={styles.messageBox}>
          <Ionicons name="checkmark-circle" size={16} color={colors.successText} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <Ionicons name={POSITION_ICONS[position]} size={20} color={POSITION_COLORS[position]} />
        <Text style={styles.checklistTitle}>{title || `${POSITION_LABELS[position]} Checklist`}</Text>
      </View>
      {jobSite ? (
        <View
          style={[
            styles.branchTag,
            { backgroundColor: `${colorForBranch(jobSite)}1a`, borderColor: colorForBranch(jobSite) },
          ]}
        >
          <Text style={[styles.branchTagText, { color: colorForBranch(jobSite) }]}>{jobSite}</Text>
        </View>
      ) : (
        <Text style={styles.meta}>All branches</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <ChecklistFillSection
        section="opening"
        title="Opening"
        icon="sunny-outline"
        items={checklist.openingItems}
        statuses={checklist.openingStatuses}
        savingKey={savingKey}
        uploadingKey={uploadingKey}
        isSubmitting={submittingSection === 'opening'}
        onMark={(item, done) => mark('opening', item, done)}
        onPhoto={(item, fromCamera) => attachPhoto('opening', item, fromCamera)}
        onSubmit={() => submit('opening')}
      />

      <ChecklistFillSection
        section="closing"
        title="Closing"
        icon="moon-outline"
        items={checklist.closingItems}
        statuses={checklist.closingStatuses}
        savingKey={savingKey}
        uploadingKey={uploadingKey}
        isSubmitting={submittingSection === 'closing'}
        onMark={(item, done) => mark('closing', item, done)}
        onPhoto={(item, fromCamera) => attachPhoto('closing', item, fromCamera)}
        onSubmit={() => submit('closing')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checklistTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  branchTag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  branchTagText: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.textMuted },
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
  itemTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemText: { fontSize: 15, color: colors.text, flex: 1 },
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
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  photoButtonText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  photoThumb: { width: 64, height: 64, borderRadius: 8 },
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

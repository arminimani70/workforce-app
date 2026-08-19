import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { SignaturePad } from '../components/SignaturePad';
import type { AppStackParamList } from '../navigation/types';

type Section = 'opening' | 'closing';

// One task, collapsed to a status icon + name by default — tapping it opens Done/Not Done and
// an optional note, mirroring the tap-to-expand task cards in Connecteam-style checklists.
// Photos aren't per item — see the batch step in the submit confirmation modal below.
function ChecklistItemCard({
  item,
  status,
  isExpanded,
  isSaving,
  onToggleExpand,
  onMark,
  onSaveNote,
}: {
  item: string;
  status?: ChecklistItemStatus;
  isExpanded: boolean;
  isSaving: boolean;
  onToggleExpand: () => void;
  onMark: (done: boolean) => void;
  onSaveNote: (note: string) => void;
}) {
  const [noteText, setNoteText] = useState(status?.note ?? '');

  useEffect(() => {
    setNoteText(status?.note ?? '');
  }, [status?.note]);

  const statusIcon =
    status?.done === true ? 'checkmark-circle' : status?.done === false ? 'close-circle' : 'ellipse-outline';
  const statusColor =
    status?.done === true ? colors.success : status?.done === false ? colors.danger : colors.textFaint;

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHeader} onPress={onToggleExpand}>
        <Ionicons name={statusIcon} size={20} color={statusColor} />
        <Text style={styles.itemText}>{item}</Text>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
      </Pressable>

      {isExpanded && (
        <View style={styles.cardBody}>
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

          {status && (
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.textFaint}
              value={noteText}
              onChangeText={setNoteText}
              onEndEditing={() => {
                if (noteText !== (status.note ?? '')) onSaveNote(noteText);
              }}
              multiline
            />
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
  expandedKey,
  savingKey,
  isSubmitting,
  onToggleExpand,
  onMark,
  onSaveNote,
  onSubmit,
}: {
  section: Section;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  statuses: ChecklistItemStatus[];
  expandedKey: string | null;
  savingKey: string | null;
  isSubmitting: boolean;
  onToggleExpand: (item: string) => void;
  onMark: (item: string, done: boolean) => void;
  onSaveNote: (item: string, note: string) => void;
  onSubmit: () => void;
}) {
  const answeredCount = items.filter((item) => statuses.some((s) => s.item === item)).length;
  const canSubmit = items.length > 0 && answeredCount === items.length;
  const progress = items.length > 0 ? answeredCount / items.length : 0;

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
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {items.map((item) => (
            <ChecklistItemCard
              key={item}
              item={item}
              status={statuses.find((s) => s.item === item)}
              isExpanded={expandedKey === `${section}:${item}`}
              isSaving={savingKey === `${section}:${item}`}
              onToggleExpand={() => onToggleExpand(item)}
              onMark={(done) => onMark(item, done)}
              onSaveNote={(note) => onSaveNote(item, note)}
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [submittingSection, setSubmittingSection] = useState<Section | null>(null);
  const [signatureSection, setSignatureSection] = useState<Section | null>(null);
  const [signature, setSignature] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
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

  const toggleExpand = (section: Section, item: string) => {
    const key = `${section}:${item}`;
    setExpandedKey((prev) => (prev === key ? null : key));
  };

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

  const saveNote = async (section: Section, item: string, note: string) => {
    if (!checklist) return;
    const field = section === 'opening' ? 'openingStatuses' : 'closingStatuses';
    const status = checklist[field].find((s) => s.item === item);
    if (!status) return;
    const current = checklist[field];

    setChecklist({
      ...checklist,
      [field]: current.map((s) => (s.item === item ? { ...s, note } : s)),
    });
    setError(null);
    try {
      if (section === 'opening') {
        await authFetch((token) => checklistsApi.updateOpening(token, position, jobSite, item, status.done, note));
      } else {
        await authFetch((token) => checklistsApi.updateClosing(token, position, jobSite, item, status.done, note));
      }
    } catch (err) {
      setChecklist({ ...checklist, [field]: current });
      setError(err instanceof HttpError ? err.message : 'Could not save note');
    }
  };

  const openSignature = (section: Section) => {
    setSignature('');
    setPhotos([]);
    setSignatureSection(section);
  };

  // Camera-only, deliberately — an attach-from-library option would let someone submit an old
  // or borrowed photo as "proof" instead of one taken at the moment of submitting. One batch for
  // the whole round (capped at 8), not one per item.
  const capturePhoto = async () => {
    if (photos.length >= 8) return;
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Camera permission denied');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;

      setIsCapturingPhoto(true);
      const manipulated = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.5, format: SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        setError('Could not process the image');
        return;
      }
      setPhotos((prev) => [...prev, `data:image/jpeg;base64,${manipulated.base64}`]);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not attach photo');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmSubmit = async () => {
    const section = signatureSection;
    if (!section || !signature) return;
    setSubmittingSection(section);
    setError(null);
    try {
      if (section === 'opening') {
        await authFetch((token) => checklistsApi.submitOpening(token, position, jobSite, signature, photos));
      } else {
        await authFetch((token) => checklistsApi.submitClosing(token, position, jobSite, signature, photos));
      }
      setSignatureSection(null);
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
        expandedKey={expandedKey}
        savingKey={savingKey}
        isSubmitting={submittingSection === 'opening'}
        onToggleExpand={(item) => toggleExpand('opening', item)}
        onMark={(item, done) => mark('opening', item, done)}
        onSaveNote={(item, note) => saveNote('opening', item, note)}
        onSubmit={() => openSignature('opening')}
      />

      <ChecklistFillSection
        section="closing"
        title="Closing"
        icon="moon-outline"
        items={checklist.closingItems}
        statuses={checklist.closingStatuses}
        expandedKey={expandedKey}
        savingKey={savingKey}
        isSubmitting={submittingSection === 'closing'}
        onToggleExpand={(item) => toggleExpand('closing', item)}
        onMark={(item, done) => mark('closing', item, done)}
        onSaveNote={(item, note) => saveNote('closing', item, note)}
        onSubmit={() => openSignature('closing')}
      />

      <Modal visible={signatureSection !== null} animationType="fade" transparent onRequestClose={() => setSignatureSection(null)}>
        <View style={styles.signatureBackdrop}>
          <View style={styles.signatureCard}>
            {checklist.allowPhoto && (
              <>
                <Text style={styles.signatureTitle}>Photos (optional, up to 8)</Text>
                <View style={styles.photoGrid}>
                  {photos.map((uri, index) => (
                    <View key={index} style={styles.photoThumbWrap}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <Pressable style={styles.photoRemoveButton} onPress={() => removePhoto(index)}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < 8 && (
                    <Pressable style={styles.photoAddButton} onPress={capturePhoto} disabled={isCapturingPhoto}>
                      {isCapturingPhoto ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="camera-outline" size={20} color={colors.primary} />
                      )}
                    </Pressable>
                  )}
                </View>
              </>
            )}

            <Text style={styles.signatureTitle}>Sign to confirm submission</Text>
            <SignaturePad key={signatureSection ?? 'none'} onChange={setSignature} />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.signatureButtonRow}>
              <Pressable style={styles.signatureCancelButton} onPress={() => setSignatureSection(null)}>
                <Text style={styles.signatureCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.signatureConfirmButton, !signature && styles.submitButtonDisabled]}
                onPress={confirmSubmit}
                disabled={!signature || submittingSection !== null}
              >
                {submittingSection !== null ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.signatureConfirmButtonText}>Confirm & Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  cardBody: { gap: 10, padding: 10, paddingTop: 0 },
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
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    color: colors.text,
    minHeight: 36,
    textAlignVertical: 'top',
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumbWrap: { width: 64, height: 64 },
  photoThumb: { width: 64, height: 64, borderRadius: 8 },
  photoRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddButton: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  signatureBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  signatureCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    ...cardShadow,
  },
  signatureTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  signatureButtonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  signatureCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
  },
  signatureCancelButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  signatureConfirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  signatureConfirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

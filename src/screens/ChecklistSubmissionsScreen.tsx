import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { checklistsApi, HttpError } from '../api/client';
import type { ChecklistSubmission } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { POSITION_COLORS, POSITION_ICONS, POSITION_LABELS } from '../constants/positions';

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// The signature's coordinates come from whatever width the signer's device happened to have —
// there's no stored canvas size to render against, so fit a viewBox to the path's own bounding
// box (plus a little padding) instead, and let SVG scale that to fill the display box.
function SignaturePreview({ path }: { path: string }) {
  const points = [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
  if (points.length === 0) return null;

  const pad = 6;
  const minX = Math.min(...points.map((p) => p.x)) - pad;
  const minY = Math.min(...points.map((p) => p.y)) - pad;
  const maxX = Math.max(...points.map((p) => p.x)) + pad;
  const maxY = Math.max(...points.map((p) => p.y)) + pad;

  return (
    <Svg width="100%" height={70} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet">
      <Path d={path} stroke={colors.text} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ChecklistSubmissionsScreen() {
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => checklistsApi.listSubmissions(token));
      setSubmissions(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load submissions');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={submissions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="file-tray-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No checklists have been submitted yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Ionicons
                name={item.section === 'opening' ? 'sunny-outline' : 'moon-outline'}
                size={16}
                color={colors.teal}
              />
              <Text style={styles.employeeName}>
                {item.submittedBy.fullName} · {item.section === 'opening' ? 'Opening' : 'Closing'}
              </Text>
              <Text style={styles.dateText}>{formatSubmittedAt(item.createdAt)}</Text>
            </View>
            <View style={styles.badgeRow}>
              <View
                style={[styles.positionBadge, { backgroundColor: `${POSITION_COLORS[item.position]}1a` }]}
              >
                <Ionicons name={POSITION_ICONS[item.position]} size={12} color={POSITION_COLORS[item.position]} />
                <Text style={[styles.positionBadgeText, { color: POSITION_COLORS[item.position] }]}>
                  {POSITION_LABELS[item.position]}
                </Text>
              </View>
              {item.jobSite && (
                <View
                  style={[
                    styles.branchTag,
                    { backgroundColor: `${colorForBranch(item.jobSite)}1a`, borderColor: colorForBranch(item.jobSite) },
                  ]}
                >
                  <Text style={[styles.branchTagText, { color: colorForBranch(item.jobSite) }]}>
                    {item.jobSite}
                  </Text>
                </View>
              )}
            </View>

            {item.statuses.map((status, index) => (
              <View key={index} style={styles.itemBlock}>
                <View style={styles.itemRow}>
                  <Ionicons
                    name={status.done ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={status.done ? colors.success : colors.danger}
                  />
                  <Text style={styles.itemText}>{status.item}</Text>
                  {status.photoUrl && (
                    <Pressable onPress={() => setViewerPhoto(status.photoUrl!)}>
                      <Image source={{ uri: status.photoUrl }} style={styles.itemPhoto} />
                    </Pressable>
                  )}
                </View>
                {status.note && <Text style={styles.noteText}>{status.note}</Text>}
              </View>
            ))}

            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Signed by {item.submittedBy.fullName}</Text>
              <View style={styles.signatureBox}>
                <SignaturePreview path={item.signature} />
              </View>
            </View>
          </View>
        )}
      />

      <Modal visible={viewerPhoto !== null} animationType="fade" transparent onRequestClose={() => setViewerPhoto(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerPhoto(null)}>
          {viewerPhoto && (
            <Image source={{ uri: viewerPhoto }} style={styles.viewerImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, marginBottom: 8 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  empty: { fontSize: 13, color: colors.textFaint },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 6,
    ...cardShadow,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  employeeName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  dateText: { fontSize: 12, color: colors.textMuted },
  badgeRow: { flexDirection: 'row', gap: 8 },
  positionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  positionBadgeText: { fontSize: 11, fontWeight: '700' },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  branchTagText: { fontSize: 11, fontWeight: '700' },
  itemBlock: { gap: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemText: { fontSize: 13, color: colors.text, flex: 1 },
  itemPhoto: { width: 40, height: 40, borderRadius: 6 },
  noteText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginLeft: 20 },
  signatureBlock: { marginTop: 6, gap: 4 },
  signatureLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  signatureBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: { width: '100%', height: '80%' },
});

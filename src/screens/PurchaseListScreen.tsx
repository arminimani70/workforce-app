import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { stockApi, HttpError } from '../api/client';
import type { PurchaseList, PurchaseListItem } from '../types/api';
import type { AppStackParamList } from '../navigation/types';
import { cardShadow, colors } from '../theme/colors';

type Props = { route: RouteProp<AppStackParamList, 'PurchaseList'> };

function formatTargetDate(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatLastCounted(iso: string | null) {
  if (!iso) return 'No stock count submitted yet';
  return `Last counted ${new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function Row({ item }: { item: PurchaseListItem }) {
  const needsBuying = item.suggestedQuantity > 0;
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.productName}>{item.productName}</Text>
        <Text style={styles.targetDate}>{formatTargetDate(item.targetDate)}</Text>
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.detailText}>
          On hand: {item.currentOnHand} {item.unit} · Par: {item.parLevel} {item.unit}
        </Text>
        <View style={[styles.buyBadge, needsBuying ? styles.buyBadgeActive : styles.buyBadgeDone]}>
          <Ionicons
            name={needsBuying ? 'cart-outline' : 'checkmark-circle'}
            size={14}
            color={needsBuying ? colors.warningText : colors.successText}
          />
          <Text style={[styles.buyBadgeText, { color: needsBuying ? colors.warningText : colors.successText }]}>
            {needsBuying ? `Buy ${item.suggestedQuantity} ${item.unit}` : 'Enough on hand'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function PurchaseListScreen({ route }: Props) {
  const { template } = route.params;
  const { authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<PurchaseList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => stockApi.getPurchaseList(token, template._id));
      setList(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load the purchase list');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, template._id]);

  // Reload on focus so it reflects a count just submitted from the same list.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const toBuyCount = list?.items.filter((i) => i.suggestedQuantity > 0).length ?? 0;

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      {list && (
        <>
          <Text style={styles.subtitle}>{formatLastCounted(list.lastCountedAt)}</Text>
          <FlatList
            data={list.items}
            keyExtractor={(item) => item.productName}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
            ListEmptyComponent={
              <View style={styles.emptyRow}>
                <Ionicons name="cart-outline" size={16} color={colors.textFaint} />
                <Text style={styles.empty}>
                  Nothing to buy for the next couple of days — no product on this list has a
                  delivery day set in that window.
                </Text>
              </View>
            }
            renderItem={({ item }) => <Row item={item} />}
          />
          {list.items.length > 0 && (
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {toBuyCount === 0
                  ? 'Everything is stocked up'
                  : `${toBuyCount} product${toBuyCount === 1 ? '' : 's'} to buy`}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, marginBottom: 8 },
  subtitle: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  list: { flex: 1 },
  emptyRow: { flexDirection: 'row', gap: 8, marginTop: 24, paddingHorizontal: 8 },
  empty: { flex: 1, fontSize: 13, color: colors.textFaint, lineHeight: 18 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 6,
    ...cardShadow,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '600', color: colors.text },
  targetDate: { fontSize: 12, fontWeight: '600', color: colors.primary },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  detailText: { flex: 1, fontSize: 12, color: colors.textMuted },
  buyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  buyBadgeActive: { backgroundColor: colors.warningBg },
  buyBadgeDone: { backgroundColor: colors.successBg },
  buyBadgeText: { fontSize: 12, fontWeight: '700' },
  summaryBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    alignItems: 'center',
  },
  summaryText: { fontSize: 13, fontWeight: '600', color: colors.text },
});

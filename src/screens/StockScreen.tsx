import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { stockApi, HttpError } from '../api/client';
import type { StockTemplate } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

export default function StockScreen() {
  const { user, authFetch } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState<StockTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => stockApi.listTemplates(token));
      setTemplates(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load stock lists');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  // Refetch every time this screen regains focus — e.g. coming back from submitting a count,
  // so the list doesn't show stale data.
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

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={templates}
        keyExtractor={(item) => item._id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="cube-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No stock lists have been set up yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.templateRow}
            onPress={() => navigation.navigate('StockSubmit', { template: item })}
          >
            <Ionicons name="cube-outline" size={20} color={colors.primary} />
            <View style={styles.templateTextGroup}>
              <Text style={styles.templateTitle}>{item.title}</Text>
              <Text style={styles.templateMeta}>{item.items.length} products</Text>
            </View>
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
            <Pressable
              onPress={() => navigation.navigate('PurchaseList', { template: item })}
              hitSlop={8}
              style={styles.cartButton}
            >
              <Ionicons name="cart-outline" size={20} color={colors.teal} />
            </Pressable>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      />

      {canManage && (
        <View style={[styles.managerRow, { paddingBottom: insets.bottom }]}>
          <Pressable style={styles.manageButton} onPress={() => navigation.navigate('ManageStock')}>
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Manage Lists</Text>
          </Pressable>
          <Pressable
            style={styles.manageButton}
            onPress={() => navigation.navigate('StockSubmissions')}
          >
            <Ionicons name="time-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Submission History</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, marginBottom: 8 },
  list: { flex: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  empty: { fontSize: 13, color: colors.textFaint },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...cardShadow,
  },
  templateTextGroup: { flex: 1 },
  templateTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  templateMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  branchTagText: { fontSize: 12, fontWeight: '700' },
  cartButton: { padding: 2 },
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
});

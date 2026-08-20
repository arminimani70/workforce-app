import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { stockApi, HttpError } from '../api/client';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { toEnglishDigits } from '../utils/digits';
import type { AppStackParamList } from '../navigation/types';

export default function StockSubmitScreen() {
  const { authFetch } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'StockSubmit'>>();
  const { template } = route.params;
  const insets = useSafeAreaInsets();

  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    const missing = template.items.some((_, index) => !quantities[index]?.trim());
    if (missing) {
      setError('Enter a quantity for every product');
      return;
    }
    const parsed = template.items.map((item, index) => ({
      productName: item.productName,
      quantity: Number(quantities[index]),
    }));
    if (parsed.some((q) => Number.isNaN(q.quantity) || q.quantity < 0)) {
      setError('Quantities must be numbers, 0 or greater');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authFetch((token) =>
        stockApi.submit(token, { stockTemplateId: template._id, quantities: parsed }),
      );
      navigation.goBack();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not submit stock count');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{template.title}</Text>
          <View
            style={[
              styles.branchTag,
              { backgroundColor: `${colorForBranch(template.jobSite)}1a`, borderColor: colorForBranch(template.jobSite) },
            ]}
          >
            <Text style={[styles.branchTagText, { color: colorForBranch(template.jobSite) }]}>
              {template.jobSite}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>{template.items.length} products</Text>

        {template.items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <View style={styles.itemTextGroup}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemUnit}>{item.unit}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={quantities[index] ?? ''}
              onChangeText={(text) =>
                setQuantities((prev) => ({ ...prev, [index]: toEnglishDigits(text) }))
              }
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
        ))}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  branchTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  branchTagText: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    ...cardShadow,
  },
  itemTextGroup: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemUnit: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  input: {
    width: 90,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    textAlign: 'right',
    backgroundColor: colors.background,
  },
  error: { color: colors.danger },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
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
});

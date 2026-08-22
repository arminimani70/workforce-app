import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { branchesApi, wastageApi, HttpError } from '../api/client';
import type { Branch, WastageReason } from '../types/api';
import { cardShadow, colorForBranch, colors } from '../theme/colors';
import { NoteBox } from '../components/NoteBox';
import type { AppStackParamList } from '../navigation/types';

export default function WastageScreen() {
  const { user, authFetch } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [reasons, setReasons] = useState<WastageReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [jobSite, setJobSite] = useState('');
  const [reason, setReason] = useState('');
  const [productName, setProductName] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const [orgBranches, orgReasons] = await Promise.all([
        authFetch((token) => branchesApi.list(token)),
        authFetch((token) => wastageApi.listReasons(token)),
      ]);
      setBranches(orgBranches);
      setReasons(orgReasons);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load wastage form');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async () => {
    if (!jobSite) {
      setError('Pick a branch');
      return;
    }
    if (!reason) {
      setError('Pick a reason');
      return;
    }
    if (!productName.trim() || !amount.trim()) {
      setError('Enter the product name and its amount');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authFetch((token) =>
        wastageApi.create(token, {
          jobSite,
          reason,
          productName: productName.trim(),
          amount: amount.trim(),
        }),
      );
      setProductName('');
      setAmount('');
      setMessage('Wastage reported');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not submit wastage report');
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {message && (
        <View style={styles.messageBox}>
          <Ionicons name="checkmark-circle" size={16} color={colors.successText} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}

      {branches.length === 0 && (
        <NoteBox variant="warning">No branches set up yet — ask a manager to add one.</NoteBox>
      )}
      {reasons.length === 0 && (
        <NoteBox variant="warning">No wastage reasons set up yet — ask a manager to add one.</NoteBox>
      )}

      <Text style={styles.sectionLabel}>Branch</Text>
      <View style={styles.chipsWrap}>
        {branches.map((branch) => {
          const isActive = jobSite === branch.name;
          const color = colorForBranch(branch.name);
          return (
            <Pressable
              key={branch._id}
              style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
              onPress={() => setJobSite(branch.name)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {branch.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Reason</Text>
      <View style={styles.chipsWrap}>
        {reasons.map((r) => {
          const isActive = reason === r.label;
          return (
            <Pressable
              key={r._id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setReason(r.label)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Product Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Whole Milk"
        value={productName}
        onChangeText={setProductName}
      />

      <Text style={styles.sectionLabel}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 2 liters"
        value={amount}
        onChangeText={setAmount}
      />

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
            <Text style={styles.submitButtonText}>Report Wastage</Text>
          </>
        )}
      </Pressable>

      {canManage && (
        <View style={styles.managerRow}>
          <Pressable
            style={styles.manageButton}
            onPress={() => navigation.navigate('ManageWastageReasons')}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Manage Reasons</Text>
          </Pressable>
          <Pressable
            style={styles.manageButton}
            onPress={() => navigation.navigate('WastageEntries')}
          >
            <Ionicons name="time-outline" size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Entry History</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
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
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    marginTop: 4,
    ...cardShadow,
  },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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

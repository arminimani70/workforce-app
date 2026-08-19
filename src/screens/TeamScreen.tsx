import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { HttpError, usersApi } from '../api/client';
import type { OrgMember, UserRole } from '../types/api';
import { cardShadow, colors } from '../theme/colors';

const ROLE_COLORS: Record<UserRole, string> = {
  owner: colors.amber,
  manager: colors.purple,
  employee: colors.primary,
};

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function TeamScreen() {
  const { user, authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => usersApi.list(token));
      setMembers(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load team');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const onAddEmployee = async () => {
    setError(null);
    setIsCreating(true);
    try {
      await authFetch((token) =>
        usersApi.createEmployee(token, {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      );
      setFullName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not add employee');
    } finally {
      setIsCreating(false);
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
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="people-outline" size={16} color={colors.text} />
        <Text style={styles.sectionTitleDark}>Team ({members.length})</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={members}
        keyExtractor={(item) => item._id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] }]}>
              <Text style={styles.avatarText}>{initials(item.fullName)}</Text>
            </View>
            <View style={styles.memberTextGroup}>
              <Text style={styles.memberName}>{item.fullName}</Text>
              <Text style={styles.memberMeta}>{item.email}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: `${ROLE_COLORS[item.role]}1a` }]}>
              <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[item.role] }]}>
                {item.role}
              </Text>
            </View>
          </View>
        )}
      />

      {canManage && (
        <View style={styles.formBox}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="person-add-outline" size={16} color={colors.text} />
            <Text style={styles.formTitle}>Add Employee</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Temporary password (min 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            style={[styles.button, isCreating && styles.buttonDisabled]}
            onPress={onAddEmployee}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Add Employee</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  error: { color: colors.danger, marginBottom: 12 },
  list: { flexGrow: 0 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...cardShadow,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  memberTextGroup: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.text },
  memberMeta: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  roleBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  formBox: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginTop: 16, gap: 8 },
  formTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    borderRadius: 10,
    padding: 14,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

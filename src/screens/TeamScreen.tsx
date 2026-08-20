import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
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
import { PopupModal } from '../components/PopupModal';

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

  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'employee' | 'manager'>('employee');
  const [editActive, setEditActive] = useState(true);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

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

  const openMember = (member: OrgMember) => {
    setSelectedMember(member);
    setEditFullName(member.fullName);
    setEditEmail(member.email);
    setEditRole(member.role === 'manager' ? 'manager' : 'employee');
    setEditActive(member.status !== 'suspended');
    setMemberError(null);
  };

  const closeMember = () => setSelectedMember(null);

  const isSelf = selectedMember?._id === user?._id;
  const isOwnerRow = selectedMember?.role === 'owner';
  const canEditSelected = canManage && !isSelf && !isOwnerRow;

  const onSaveMember = async () => {
    if (!selectedMember) return;
    setMemberError(null);
    setIsSavingMember(true);
    try {
      await authFetch((token) =>
        usersApi.updateEmployee(token, selectedMember._id, {
          fullName: editFullName.trim(),
          email: editEmail.trim(),
          role: editRole,
          status: editActive ? 'active' : 'suspended',
        }),
      );
      closeMember();
      await load();
    } catch (err) {
      setMemberError(err instanceof HttpError ? err.message : 'Could not save changes');
    } finally {
      setIsSavingMember(false);
    }
  };

  const onDeleteMember = async () => {
    if (!selectedMember) return;
    setMemberError(null);
    setIsDeletingMember(true);
    try {
      await authFetch((token) => usersApi.deleteEmployee(token, selectedMember._id));
      closeMember();
      await load();
    } catch (err) {
      setMemberError(err instanceof HttpError ? err.message : 'Could not remove employee');
    } finally {
      setIsDeletingMember(false);
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
          <Pressable
            style={styles.memberRow}
            onPress={() => (canManage ? openMember(item) : undefined)}
          >
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
            {canManage && (
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            )}
          </Pressable>
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

      <PopupModal visible={selectedMember !== null} onClose={closeMember}>
        {selectedMember && (
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.avatarLarge, { backgroundColor: ROLE_COLORS[selectedMember.role] }]}>
                <Text style={styles.avatarLargeText}>{initials(selectedMember.fullName)}</Text>
              </View>
              <View style={styles.memberTextGroup}>
                <Text style={styles.modalName}>{selectedMember.fullName}</Text>
                <Text style={styles.memberMeta}>{selectedMember.email}</Text>
              </View>
            </View>

            {!canEditSelected ? (
              <Text style={styles.readOnlyNote}>
                {isSelf
                  ? "You can't edit your own account here — use Profile instead."
                  : "The organization owner's account can't be edited or removed here."}
              </Text>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Full name</Text>
                <TextInput style={styles.input} value={editFullName} onChangeText={setEditFullName} />

                <Text style={styles.sectionLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={editEmail}
                  onChangeText={setEditEmail}
                />

                <Text style={styles.sectionLabel}>Role</Text>
                <View style={styles.chipsWrap}>
                  {(['employee', 'manager'] as const).map((r) => {
                    const isActive = editRole === r;
                    return (
                      <Pressable
                        key={r}
                        style={[styles.chip, isActive && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                        onPress={() => setEditRole(r)}
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                          {r === 'employee' ? 'Employee' : 'Manager'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.sectionLabel}>Active</Text>
                  <Switch value={editActive} onValueChange={setEditActive} />
                </View>

                {memberError && <Text style={styles.error}>{memberError}</Text>}

                <Pressable
                  style={[styles.button, isSavingMember && styles.buttonDisabled]}
                  onPress={onSaveMember}
                  disabled={isSavingMember || isDeletingMember}
                >
                  {isSavingMember ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#fff" />
                      <Text style={styles.buttonText}>Save Changes</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.deleteButton, isDeletingMember && styles.buttonDisabled]}
                  onPress={onDeleteMember}
                  disabled={isSavingMember || isDeletingMember}
                >
                  {isDeletingMember ? (
                    <ActivityIndicator color={colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      <Text style={styles.deleteButtonText}>Remove from Team</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}
      </PopupModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
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
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
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
  modalCard: { padding: 20, gap: 10 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  modalName: { fontSize: 17, fontWeight: '700', color: colors.text },
  readOnlyNote: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 14,
  },
  deleteButtonText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});

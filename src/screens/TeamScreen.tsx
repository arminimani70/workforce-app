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
import { useAuth } from '../auth/AuthContext';
import { HttpError, usersApi } from '../api/client';
import type { OrgMember } from '../types/api';

export default function TeamScreen() {
  const { user, authFetch } = useAuth();
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
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={members}
        keyExtractor={(item) => item._id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Text style={styles.memberName}>{item.fullName}</Text>
            <Text style={styles.memberMeta}>
              {item.email} · {item.role}
            </Text>
          </View>
        )}
      />

      {canManage && (
        <View style={styles.formBox}>
          <Text style={styles.formTitle}>Add Employee</Text>
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
              <Text style={styles.buttonText}>Add Employee</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#c0392b', marginBottom: 12 },
  list: { flexGrow: 0 },
  memberRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  formBox: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16, marginTop: 16, gap: 8 },
  formTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

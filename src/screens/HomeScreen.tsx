import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user?.fullName}</Text>
      <Text style={styles.subtitle}>
        {user?.email} · {user?.role}
      </Text>

      <Pressable
        style={styles.timeClockButton}
        onPress={() => navigation.navigate('TimeClock')}
      >
        <Text style={styles.buttonText}>Time Clock</Text>
      </Pressable>

      <Pressable
        style={styles.scheduleButton}
        onPress={() => navigation.navigate('Schedule')}
      >
        <Text style={styles.buttonText}>Schedule</Text>
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24 },
  timeClockButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  scheduleButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

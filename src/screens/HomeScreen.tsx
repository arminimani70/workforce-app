import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { availabilityApi, schedulingApi, tasksApi, timeClockApi, usersApi } from '../api/client';
import type { AppStackParamList } from '../navigation/types';
import type { Shift, TimeClockEntry } from '../types/api';
import { formatElapsed, todayRange } from '../utils/time';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

function formatShiftLine(shift: Shift) {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startText = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endText = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startText}–${endText}`;
}

export default function HomeScreen({ navigation }: Props) {
  const { user, logout, authFetch } = useAuth();
  const [openEntry, setOpenEntry] = useState<TimeClockEntry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [nextShift, setNextShift] = useState<Shift | null>(null);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [availableDaysCount, setAvailableDaysCount] = useState<number | null>(null);
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [pendingTaskCount, setPendingTaskCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await authFetch((token) => timeClockApi.status(token));
        setOpenEntry(status);
      } catch {
        // Leave as "not clocked in" if the status call fails.
      }
    })();

    (async () => {
      try {
        const shifts = await authFetch((token) => schedulingApi.myShifts(token));
        const approved = shifts.filter((s) => s.approval === 'approved');
        const upcoming = approved
          .filter((s) => new Date(s.startTime).getTime() >= Date.now())
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setNextShift(upcoming[0] ?? null);
      } catch {
        // Leave as "no upcoming shift" if the call fails.
      }
    })();

    (async () => {
      try {
        const { from, to } = todayRange();
        const shifts = await authFetch((token) =>
          schedulingApi.myShifts(token, { from, to: new Date(to).toISOString() }),
        );
        setTodayShifts(shifts.filter((s) => s.approval === 'approved'));
      } catch {
        // Leave "Today" empty if the call fails.
      }
    })();

    (async () => {
      try {
        const availability = await authFetch((token) => availabilityApi.getMine(token));
        setAvailableDaysCount(
          availability.days.filter((d) => d.status !== 'unavailable').length,
        );
      } catch {
        // Leave the Availability subtitle blank if the call fails.
      }
    })();

    (async () => {
      try {
        const members = await authFetch((token) => usersApi.list(token));
        setTeamSize(members.length);
      } catch {
        // Leave the Team subtitle blank if the call fails.
      }
    })();

    (async () => {
      try {
        const tasks = await authFetch((token) => tasksApi.mine(token));
        setPendingTaskCount(tasks.filter((t) => t.status !== 'done').length);
      } catch {
        // Leave the Tasks subtitle blank if the call fails.
      }
    })();
  }, [authFetch]);

  useEffect(() => {
    if (!openEntry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  const timeClockSubtitle = openEntry
    ? `Clocked in · ${formatElapsed(now - new Date(openEntry.clockInTime).getTime())}`
    : 'Not clocked in';

  const scheduleSubtitle = nextShift ? `Next: ${formatShiftLine(nextShift)}` : 'No upcoming shifts';

  const availabilitySubtitle =
    availableDaysCount === null ? ' ' : `${availableDaysCount} of 7 days available`;

  const teamSubtitle = teamSize === null ? ' ' : `${teamSize} team member${teamSize === 1 ? '' : 's'}`;

  const tasksSubtitle =
    pendingTaskCount === null
      ? ' '
      : pendingTaskCount === 0
        ? 'All caught up'
        : `${pendingTaskCount} open task${pendingTaskCount === 1 ? '' : 's'}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome, {user?.fullName}</Text>
      <Text style={styles.subtitle}>
        {user?.email} · {user?.role}
      </Text>

      <Pressable
        style={[styles.card, styles.cardTimeClock]}
        onPress={() => navigation.navigate('TimeClock')}
      >
        <Text style={styles.cardTitle}>Time Clock</Text>
        <Text style={styles.cardSubtitle}>{timeClockSubtitle}</Text>
      </Pressable>

      <Pressable
        style={[styles.card, styles.cardSchedule]}
        onPress={() => navigation.navigate('Schedule')}
      >
        <Text style={styles.cardTitle}>Schedule</Text>
        <Text style={styles.cardSubtitle}>{scheduleSubtitle}</Text>
      </Pressable>

      <Pressable
        style={[styles.card, styles.cardAvailability]}
        onPress={() => navigation.navigate('Availability')}
      >
        <Text style={styles.cardTitle}>Availability</Text>
        <Text style={styles.cardSubtitle}>{availabilitySubtitle}</Text>
      </Pressable>

      <Pressable style={[styles.card, styles.cardTeam]} onPress={() => navigation.navigate('Team')}>
        <Text style={styles.cardTitle}>Team</Text>
        <Text style={styles.cardSubtitle}>{teamSubtitle}</Text>
      </Pressable>

      <Pressable
        style={[styles.card, styles.cardTasks]}
        onPress={() => navigation.navigate('Tasks')}
      >
        <Text style={styles.cardTitle}>Tasks</Text>
        <Text style={styles.cardSubtitle}>{tasksSubtitle}</Text>
      </Pressable>

      <View style={styles.todaySection}>
        <Text style={styles.todayTitle}>Today</Text>
        {todayShifts.length === 0 ? (
          <Text style={styles.todayEmpty}>No shifts today</Text>
        ) : (
          todayShifts.map((shift) => (
            <View key={shift._id} style={styles.todayRow}>
              <Text style={styles.todayText}>
                {new Date(shift.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                –
                {new Date(shift.endTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {shift.jobSite ? ` · ${shift.jobSite}` : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 12 },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  cardTimeClock: { backgroundColor: '#2563eb' },
  cardSchedule: { backgroundColor: '#0f766e' },
  cardAvailability: { backgroundColor: '#7c3aed' },
  cardTeam: { backgroundColor: '#b45309' },
  cardTasks: { backgroundColor: '#be185d' },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  todaySection: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  todayTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  todayEmpty: { fontSize: 13, color: '#999' },
  todayRow: { paddingVertical: 2 },
  todayText: { fontSize: 14, color: '#333' },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

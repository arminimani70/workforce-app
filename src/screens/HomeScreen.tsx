import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import {
  availabilityApi,
  messagesApi,
  schedulingApi,
  tasksApi,
  timeClockApi,
  usersApi,
} from '../api/client';
import type { AppStackParamList } from '../navigation/types';
import type { Shift, TimeClockEntry } from '../types/api';
import { currentWeekRange, formatElapsed, fullDayRange } from '../utils/time';
import { syncShiftReminders } from '../utils/shiftReminders';
import { useTodayShiftContext } from '../hooks/useTodayShiftContext';
import { POSITION_LABELS } from '../constants/positions';
import { cardShadow, colors } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

type IconName = keyof typeof Ionicons.glyphMap;

function formatShiftLine(shift: Shift) {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startText = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endText = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startText}–${endText}`;
}

function initials(fullName: string | undefined) {
  if (!fullName) return '?';
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function DashboardCard({
  icon,
  tint,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  tint: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.cardIconBadge, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <View style={styles.cardTextGroup}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { user, logout, authFetch } = useAuth();
  const insets = useSafeAreaInsets();
  const [openEntry, setOpenEntry] = useState<TimeClockEntry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [nextShift, setNextShift] = useState<Shift | null>(null);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [availableDaysCount, setAvailableDaysCount] = useState<number | null>(null);
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [pendingTaskCount, setPendingTaskCount] = useState<number | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number | null>(null);

  // useFocusEffect (not a plain useEffect) so this re-fetches every time Home regains focus,
  // not just on first mount — React Navigation keeps Home mounted underneath other screens, so
  // a plain mount-only effect left the clock-in status stale after clocking in/out on the Time
  // Clock screen and coming back (the dashboard card kept ticking as if still clocked in).
  useFocusEffect(
    useCallback(() => {
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
          syncShiftReminders(shifts);
        } catch {
          // Leave as "no upcoming shift" if the call fails.
        }
      })();

      (async () => {
        try {
          const { from, to } = fullDayRange();
          const shifts = await authFetch((token) => schedulingApi.myShifts(token, { from, to }));
          setTodayShifts(shifts.filter((s) => s.approval === 'approved'));
        } catch {
          // Leave "Today" empty if the call fails.
        }
      })();

      (async () => {
        try {
          const entries = await authFetch((token) =>
            availabilityApi.getMine(token, currentWeekRange()),
          );
          setAvailableDaysCount(entries.filter((e) => e.status !== 'unavailable').length);
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

      (async () => {
        try {
          const { count } = await authFetch((token) => messagesApi.unreadCount(token));
          setUnreadMessageCount(count);
        } catch {
          // Leave the Messages subtitle blank if the call fails.
        }
      })();
    }, [authFetch]),
  );

  useEffect(() => {
    if (!openEntry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  const { branch: todayBranch, position: todayPosition, startTime: shiftStart } =
    useTodayShiftContext();

  const timeClockSubtitle = openEntry
    ? `Clocked in · ${formatElapsed(now - new Date(openEntry.clockInTime).getTime())}`
    : 'Not clocked in';

  // The person's main "what's happening today" event — clocked-in status takes over from the
  // pre-shift heads-up the moment they actually clock in. Shown as a headline banner rather
  // than buried as a Time Clock screen detail, and it's tappable straight into Time Clock.
  const eventShiftDetail = [
    todayBranch?.name,
    todayPosition ? POSITION_LABELS[todayPosition] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  let eventHeadline: string | null = null;
  if (openEntry) {
    const startLabel = new Date(openEntry.clockInTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    eventHeadline = `Clocked in since ${startLabel}`;
  } else if (shiftStart && shiftStart.getTime() - Date.now() <= 3 * 60 * 60 * 1000) {
    const startLabel = shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    eventHeadline =
      shiftStart.getTime() <= Date.now()
        ? `Shift in progress · started ${startLabel}`
        : `Shift today at ${startLabel}`;
  }

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

  const messagesSubtitle =
    unreadMessageCount === null
      ? ' '
      : unreadMessageCount === 0
        ? 'No new messages'
        : `${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}`;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <Pressable style={styles.header} onPress={() => navigation.navigate('Profile')}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
          </View>
        )}
        <View>
          <Text style={styles.title}>Welcome, {user?.fullName}</Text>
          <Text style={styles.subtitle}>
            {user?.email} · {user?.role}
          </Text>
        </View>
      </Pressable>

      {eventHeadline && (
        <Pressable style={styles.eventBanner} onPress={() => navigation.navigate('TimeClock')}>
          <View style={styles.eventIconBadge}>
            <Ionicons
              name={openEntry ? 'radio-button-on' : 'time-outline'}
              size={22}
              color="#fff"
            />
          </View>
          <View style={styles.eventTextGroup}>
            <Text style={styles.eventTitleText}>{eventHeadline}</Text>
            {eventShiftDetail && <Text style={styles.eventSubtitleText}>{eventShiftDetail}</Text>}
          </View>
          {openEntry && (
            <Text style={styles.eventTimerText}>
              {formatElapsed(now - new Date(openEntry.clockInTime).getTime())}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
        </Pressable>
      )}

      <DashboardCard
        icon="time-outline"
        tint={colors.primary}
        title="Time Clock"
        subtitle={timeClockSubtitle}
        onPress={() => navigation.navigate('TimeClock')}
      />

      <DashboardCard
        icon="calendar-outline"
        tint={colors.teal}
        title="Schedule"
        subtitle={scheduleSubtitle}
        onPress={() => navigation.navigate('Schedule')}
      />

      <DashboardCard
        icon="checkmark-done-outline"
        tint={colors.purple}
        title="Availability"
        subtitle={availabilitySubtitle}
        onPress={() => navigation.navigate('Availability')}
      />

      <DashboardCard
        icon="people-outline"
        tint={colors.amber}
        title="Team"
        subtitle={teamSubtitle}
        onPress={() => navigation.navigate('Team')}
      />

      <DashboardCard
        icon="list-outline"
        tint={colors.pink}
        title="Tasks"
        subtitle={tasksSubtitle}
        onPress={() => navigation.navigate('Tasks')}
      />

      <DashboardCard
        icon="chatbubbles-outline"
        tint={colors.primaryDark}
        title="Messages"
        subtitle={messagesSubtitle}
        onPress={() => navigation.navigate('Messages')}
      />

      <DashboardCard
        icon="document-text-outline"
        tint={colors.success}
        title="Forms"
        subtitle="Report issues, orders, and more"
        onPress={() => navigation.navigate('Forms')}
      />

      <DashboardCard
        icon="school-outline"
        tint={colors.indigo}
        title="Onboarding"
        subtitle="Guide for new hires"
        onPress={() => navigation.navigate('Onboarding')}
      />

      <DashboardCard
        icon="person-circle-outline"
        tint={colors.cyan}
        title="Profile"
        subtitle="Your info, photo, and password"
        onPress={() => navigation.navigate('Profile')}
      />

      <View style={styles.todaySection}>
        <View style={styles.todayHeader}>
          <Ionicons name="today-outline" size={16} color={colors.text} />
          <Text style={styles.todayTitle}>Today</Text>
        </View>
        {todayShifts.length === 0 ? (
          <View style={styles.todayEmptyRow}>
            <Ionicons name="moon-outline" size={16} color={colors.textFaint} />
            <Text style={styles.todayEmpty}>No shifts today</Text>
          </View>
        ) : (
          todayShifts.map((shift) => (
            <View key={shift._id} style={styles.todayRow}>
              <Ionicons name="time-outline" size={15} color={colors.textMuted} />
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
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    ...cardShadow,
  },
  eventIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTextGroup: { flex: 1 },
  eventTitleText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  eventSubtitleText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  eventTimerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    ...cardShadow,
  },
  cardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextGroup: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  todaySection: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    gap: 8,
    ...cardShadow,
  },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  todayEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayEmpty: { fontSize: 13, color: colors.textFaint },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  todayText: { fontSize: 14, color: colors.text },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Shift } from '../types/api';
import { POSITION_LABELS } from '../constants/positions';

const REMINDER_LEAD_MS = 60 * 60 * 1000; // 1 hour before shift start
const REMINDER_TYPE = 'shift-reminder';

let androidChannelReady = false;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync('shift-reminders', {
    name: 'Shift reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  androidChannelReady = true;
}

function reminderBody(shift: Shift): string {
  const parts = [shift.jobSite, shift.position ? POSITION_LABELS[shift.position] : null].filter(
    Boolean,
  );
  return parts.length > 0 ? `Starts in 1 hour · ${parts.join(' · ')}` : 'Starts in 1 hour';
}

// Re-syncs local "shift starts in 1 hour" reminders to match the caller's current list of
// upcoming approved shifts. Scheduled entirely on-device (no backend involved) using each
// shift's own id as the notification identifier, so re-running this whenever shifts are
// re-fetched is idempotent — it cancels reminders for shifts no longer in the list (rejected,
// rescheduled, already passed their reminder window) instead of stacking duplicates, and
// (re)schedules the rest. Best-effort: if permission is denied or scheduling fails, the app
// keeps working without reminders, same as the GPS best-effort pattern used for the clock-in
// location.
export async function syncShiftReminders(shifts: Shift[]): Promise<void> {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    await ensureAndroidChannel();

    const now = Date.now();
    const upcoming = shifts.filter(
      (s) =>
        s.approval === 'approved' && new Date(s.startTime).getTime() - REMINDER_LEAD_MS > now,
    );
    const upcomingIds = new Set(upcoming.map((s) => s._id));

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((n) => n.content.data?.type === REMINDER_TYPE);
    await Promise.all(
      ours
        .filter((n) => !upcomingIds.has(n.identifier))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    await Promise.all(
      upcoming.map((shift) =>
        Notifications.scheduleNotificationAsync({
          identifier: shift._id,
          content: {
            title: 'Shift starting soon',
            body: reminderBody(shift),
            data: { type: REMINDER_TYPE },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(new Date(shift.startTime).getTime() - REMINDER_LEAD_MS),
          },
        }),
      ),
    );
  } catch {
    // Best-effort — permission denial or a scheduling failure shouldn't break the app.
  }
}

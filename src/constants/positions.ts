import { Ionicons } from '@expo/vector-icons';
import type { Position } from '../types/api';
import { colors } from '../theme/colors';

// Single source of truth for how a position is labeled, iconed, and colored — every screen
// that shows a position (Availability, Schedule, Tasks, the week builder) imports this instead
// of keeping its own copy, so they can never drift out of sync with each other.
export const POSITION_LABELS: Record<Position, string> = {
  frontdesk: 'Front Desk',
  helpdesk: 'Help Desk',
  information: 'Information',
  consultation: 'Consultation',
  manager: 'Manager',
};

export const POSITION_ICONS: Record<Position, keyof typeof Ionicons.glyphMap> = {
  frontdesk: 'desktop-outline',
  helpdesk: 'headset-outline',
  information: 'information-circle-outline',
  consultation: 'chatbubbles-outline',
  manager: 'shield-checkmark-outline',
};

export const POSITION_COLORS: Record<Position, string> = {
  frontdesk: colors.primary,
  helpdesk: colors.teal,
  information: colors.purple,
  consultation: colors.pink,
  manager: colors.indigo,
};

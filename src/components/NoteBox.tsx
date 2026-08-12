import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type Variant = 'info' | 'warning' | 'success' | 'danger';

const VARIANT_STYLES: Record<
  Variant,
  { bg: string; border: string; text: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  info: {
    bg: colors.infoBg,
    border: colors.infoBorder,
    text: colors.infoText,
    icon: 'information-circle',
  },
  warning: {
    bg: colors.warningBg,
    border: colors.warningBorder,
    text: colors.warningText,
    icon: 'alert-circle',
  },
  success: {
    bg: colors.successBg,
    border: colors.successBorder,
    text: colors.successText,
    icon: 'checkmark-circle',
  },
  danger: {
    bg: colors.dangerBg,
    border: colors.dangerBorder,
    text: colors.dangerText,
    icon: 'close-circle',
  },
};

// A colored callout box for tips, warnings, and inline notes — icon plus text, used wherever
// a screen needs to flag something the plain body copy shouldn't carry (e.g. "3 of 5 tasks
// couldn't be assigned").
export function NoteBox({
  variant = 'info',
  children,
}: {
  variant?: Variant;
  children: React.ReactNode;
}) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[styles.container, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Ionicons name={v.icon} size={18} color={v.text} style={styles.icon} />
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
});

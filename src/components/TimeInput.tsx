import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHHMM(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutesOfDay(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// A "HH:mm" text field with iOS-style up/down steppers next to it — nudges the value by
// `step` minutes, wrapping around midnight. Still freely editable by typing, the steppers are
// just a faster way to nudge it up or down.
export function TimeInput({
  value,
  onChange,
  step = 15,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  placeholder?: string;
}) {
  const nudge = (delta: number) => {
    const base = parseHHMM(value) ?? parseHHMM(placeholder ?? '') ?? 0;
    onChange(formatMinutesOfDay(base + delta));
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
      />
      <View style={styles.steppers}>
        <Pressable style={styles.stepperButton} onPress={() => nudge(step)} hitSlop={4}>
          <Ionicons name="chevron-up" size={13} color={colors.textMuted} />
        </Pressable>
        <View style={styles.stepperDivider} />
        <Pressable style={styles.stepperButton} onPress={() => nudge(-step)} hitSlop={4}>
          <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: { flex: 1, paddingVertical: 10, paddingLeft: 12, fontSize: 15, textAlign: 'center' },
  steppers: { borderLeftWidth: 1, borderLeftColor: '#ccc', width: 26 },
  stepperButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stepperDivider: { height: 1, backgroundColor: '#ccc' },
});

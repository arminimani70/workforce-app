import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Wraps every popup in the app with the same behavior: tapping the dimmed area outside the
// card dismisses it, while taps inside the card (buttons, inputs, empty space between them)
// don't — the card is wrapped in its own no-op Pressable so it "absorbs" the touch instead of
// letting it bubble up to the backdrop. Also lifts the card above the bottom safe area (the
// iOS home indicator / Android gesture bar) so buttons near the bottom of the card stay easy
// to tap instead of crowding the edge.
export function PopupModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={{ paddingBottom: insets.bottom }} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
});

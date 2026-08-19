import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { cardShadow, colors } from '../theme/colors';

// Wraps every popup in the app with the same behavior and the same look: a centered dialog
// card, rounded on all four corners, that fades in — identical on iOS and Android instead of
// each screen growing its own bottom sheet. Tapping the dimmed backdrop dismisses it, while
// taps inside the card (buttons, inputs, empty space between them) don't — the card is wrapped
// in its own no-op Pressable so it "absorbs" the touch instead of letting it bubble up to the
// backdrop.
// The card itself is capped below the screen height and its content scrolls — content that
// would otherwise be pushed off-screen (a long form, a tall list, the keyboard covering the
// bottom of a short screen) stays reachable instead. Individual screens should NOT wrap their
// own content in another ScrollView; this one already does it for every popup in the app, and
// should NOT paint their own background/corner radius on the outermost view they pass in —
// this component already does that too.
export function PopupModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.cardShell}>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardShell: {
    width: '100%',
    maxWidth: 440,
  },
  // The maxHeight (and the card's visual chrome) has to live on the ScrollView itself, not an
  // ancestor View — that's what actually bounds its viewport so it knows content overflows and
  // needs to scroll, instead of just growing past the screen.
  scroll: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    ...cardShadow,
  },
});

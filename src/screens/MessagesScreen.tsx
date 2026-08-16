import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { HttpError, messagesApi, usersApi } from '../api/client';
import type { Conversation, OrgMember, UserRole } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { PopupModal } from '../components/PopupModal';
import type { AppStackParamList } from '../navigation/types';

const POLL_INTERVAL_MS = 8000;

const ROLE_COLORS: Record<UserRole, string> = {
  owner: colors.amber,
  manager: colors.purple,
  employee: colors.primary,
};

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatConversationTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesScreen() {
  const { user, authFetch } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => messagesApi.conversations(token));
      setConversations(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load messages');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  const openNewMessage = async () => {
    setIsNewMessageOpen(true);
    if (members.length === 0) {
      try {
        const result = await authFetch((token) => usersApi.list(token));
        setMembers(result.filter((m) => m._id !== user?._id));
      } catch {
        // Leave the picker empty if the directory fails to load.
      }
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
        data={conversations}
        keyExtractor={(item) => item.employeeId._id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="chatbubbles-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No conversations yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.conversationRow}
            onPress={() =>
              navigation.navigate('Chat', {
                employeeId: item.employeeId._id,
                employeeName: item.employeeId.fullName,
              })
            }
          >
            <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.employeeId.role] }]}>
              <Text style={styles.avatarText}>{initials(item.employeeId.fullName)}</Text>
            </View>
            <View style={styles.conversationTextGroup}>
              <Text style={styles.conversationName}>{item.employeeId.fullName}</Text>
              <Text
                style={[
                  styles.conversationPreview,
                  item.unreadCount > 0 && styles.conversationPreviewUnread,
                ]}
                numberOfLines={1}
              >
                {item.lastMessageFromMe ? 'You: ' : ''}
                {item.lastMessage}
              </Text>
            </View>
            <View style={styles.conversationMeta}>
              <Text style={styles.conversationTime}>
                {formatConversationTime(item.lastMessageAt)}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.newMessageButton} onPress={openNewMessage}>
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.newMessageButtonText}>New Message</Text>
      </Pressable>

      <PopupModal visible={isNewMessageOpen} onClose={() => setIsNewMessageOpen(false)}>
        <View style={styles.modalCard}>
          <Text style={styles.formTitle}>New Message</Text>
          {members.length === 0 ? (
            <Text style={styles.empty}>No other team members yet</Text>
          ) : (
            members.map((item) => (
              <Pressable
                key={item._id}
                style={styles.pickerRow}
                onPress={() => {
                  setIsNewMessageOpen(false);
                  navigation.navigate('Chat', { employeeId: item._id, employeeName: item.fullName });
                }}
              >
                <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] }]}>
                  <Text style={styles.avatarText}>{initials(item.fullName)}</Text>
                </View>
                <Text style={styles.pickerName}>{item.fullName}</Text>
              </Pressable>
            ))
          )}
        </View>
      </PopupModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, marginBottom: 12 },
  list: { flex: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  empty: { fontSize: 13, color: colors.textFaint },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...cardShadow,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  conversationTextGroup: { flex: 1 },
  conversationName: { fontSize: 15, fontWeight: '600', color: colors.text },
  conversationPreview: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  conversationPreviewUnread: { color: colors.text, fontWeight: '600' },
  conversationMeta: { alignItems: 'flex-end', gap: 4 },
  conversationTime: { fontSize: 12, color: colors.textFaint },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  newMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
  },
  newMessageButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  pickerName: { fontSize: 15, fontWeight: '600', color: colors.text },
});

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupParticipantIds, setGroupParticipantIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

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

  const loadMembers = useCallback(async () => {
    if (members.length > 0) return members;
    try {
      const result = await authFetch((token) => usersApi.list(token));
      const others = result.filter((m) => m._id !== user?._id);
      setMembers(others);
      return others;
    } catch {
      return [];
    }
  }, [authFetch, members, user?._id]);

  const openNewMessage = async () => {
    setIsNewMessageOpen(true);
    await loadMembers();
  };

  const openNewGroup = async () => {
    setGroupError(null);
    setGroupName('');
    setGroupParticipantIds([]);
    setIsNewGroupOpen(true);
    await loadMembers();
  };

  const openConversation = async (employeeId: string, employeeName: string) => {
    setIsNewMessageOpen(false);
    try {
      const conversation = await authFetch((token) => messagesApi.openDirect(token, employeeId));
      navigation.navigate('Chat', {
        conversationId: conversation._id,
        title: employeeName,
        type: 'direct',
      });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not start conversation');
    }
  };

  const toggleGroupParticipant = (id: string) => {
    setGroupParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const onCreateGroup = async () => {
    if (!groupName.trim()) {
      setGroupError('Give the group a name');
      return;
    }
    if (groupParticipantIds.length === 0) {
      setGroupError('Pick at least one person');
      return;
    }
    setGroupError(null);
    setIsCreatingGroup(true);
    try {
      const conversation = await authFetch((token) =>
        messagesApi.createGroup(token, {
          name: groupName.trim(),
          participantIds: groupParticipantIds,
        }),
      );
      setIsNewGroupOpen(false);
      navigation.navigate('Chat', {
        conversationId: conversation._id,
        title: groupName.trim(),
        type: 'group',
      });
      await load();
    } catch (err) {
      setGroupError(err instanceof HttpError ? err.message : 'Could not create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const titleFor = (conversation: Conversation) => {
    if (conversation.type === 'group') return conversation.name ?? 'Group';
    const other = conversation.participants.find((p) => p._id !== user?._id);
    return other?.fullName ?? 'Unknown';
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
        keyExtractor={(item) => item._id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Ionicons name="chatbubbles-outline" size={16} color={colors.textFaint} />
            <Text style={styles.empty}>No conversations yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const title = titleFor(item);
          const isGroup = item.type === 'group';
          const other = item.participants.find((p) => p._id !== user?._id);
          return (
            <Pressable
              style={styles.conversationRow}
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: item._id,
                  title,
                  type: item.type,
                })
              }
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: isGroup ? colors.teal : ROLE_COLORS[other?.role ?? 'employee'] },
                ]}
              >
                {isGroup ? (
                  <Ionicons name="people" size={20} color="#fff" />
                ) : (
                  <Text style={styles.avatarText}>{initials(title)}</Text>
                )}
              </View>
              <View style={styles.conversationTextGroup}>
                <Text style={styles.conversationName}>{title}</Text>
                <Text
                  style={[
                    styles.conversationPreview,
                    item.unreadCount > 0 && styles.conversationPreviewUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessageFromMe ? 'You: ' : ''}
                  {item.lastMessage ?? 'No messages yet'}
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
          );
        }}
      />

      <View style={[styles.actionRow, { marginBottom: Math.max(insets.bottom, 12) }]}>
        {canManage && (
          <Pressable style={[styles.actionButton, styles.groupButton]} onPress={openNewGroup}>
            <Ionicons name="people-outline" size={18} color={colors.teal} />
            <Text style={[styles.actionButtonText, styles.groupButtonText]}>New Group</Text>
          </Pressable>
        )}
        <Pressable style={styles.actionButton} onPress={openNewMessage}>
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>New Message</Text>
        </Pressable>
      </View>

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
                onPress={() => openConversation(item._id, item.fullName)}
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

      <PopupModal visible={isNewGroupOpen} onClose={() => setIsNewGroupOpen(false)}>
        <View style={styles.modalCard}>
          <Text style={styles.formTitle}>New Group</Text>
          <TextInput
            style={styles.groupNameInput}
            placeholder="Group name"
            value={groupName}
            onChangeText={setGroupName}
          />
          {members.length === 0 ? (
            <Text style={styles.empty}>No other team members yet</Text>
          ) : (
            members.map((item) => {
              const isSelected = groupParticipantIds.includes(item._id);
              return (
                <Pressable
                  key={item._id}
                  style={styles.pickerRow}
                  onPress={() => toggleGroupParticipant(item._id)}
                >
                  <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] }]}>
                    <Text style={styles.avatarText}>{initials(item.fullName)}</Text>
                  </View>
                  <Text style={styles.pickerName}>{item.fullName}</Text>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isSelected ? colors.primary : colors.textFaint}
                  />
                </Pressable>
              );
            })
          )}
          {groupError && <Text style={styles.error}>{groupError}</Text>}
          <Pressable
            style={[styles.createGroupButton, isCreatingGroup && styles.buttonDisabled]}
            onPress={onCreateGroup}
            disabled={isCreatingGroup}
          >
            {isCreatingGroup ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createGroupButtonText}>Create Group</Text>
            )}
          </Pressable>
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
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
  },
  groupButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  groupButtonText: { color: colors.teal },
  modalCard: {
    padding: 20,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  groupNameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  pickerName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  createGroupButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  createGroupButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

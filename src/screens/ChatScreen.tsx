import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../auth/AuthContext';
import { HttpError, messagesApi } from '../api/client';
import type { ChatMessage } from '../types/api';
import { colors } from '../theme/colors';
import { ATTACHMENT_DOCUMENT_TYPES, formatFileSize, iconForMimeType } from '../utils/files';
import type { AppStackParamList } from '../navigation/types';

const POLL_INTERVAL_MS = 4000;

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const { user, authFetch } = useAuth();
  const route = useRoute<RouteProp<AppStackParamList, 'Chat'>>();
  const { conversationId, type } = route.params;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    try {
      const thread = await authFetch((token) => messagesApi.messages(token, conversationId));
      setMessages(thread);
      await authFetch((token) => messagesApi.markRead(token, conversationId));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load messages');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, conversationId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    setIsSending(true);
    try {
      await authFetch((token) => messagesApi.send(token, conversationId, text));
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not send message');
    } finally {
      setIsSending(false);
    }
  };

  const onAttach = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ATTACHMENT_DOCUMENT_TYPES,
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      setIsAttaching(true);
      const text = draft.trim();
      await authFetch((token) =>
        messagesApi.sendAttachment(
          token,
          conversationId,
          { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' },
          text || undefined,
        ),
      );
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not send the file');
    } finally {
      setIsAttaching(false);
    }
  };

  const onOpenAttachment = async (message: ChatMessage) => {
    if (!message.attachment) return;
    setError(null);
    setOpeningId(message._id);
    try {
      await authFetch(async (token) => {
        const file = await File.downloadFileAsync(
          messagesApi.attachmentDownloadUrl(message._id),
          Paths.cache,
          { headers: { Authorization: `Bearer ${token}` }, idempotent: true },
        );
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: message.attachment!.mimeType });
        }
      });
    } catch {
      setError('Could not open the file');
    } finally {
      setOpeningId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const reversed = [...messages].reverse();
  const isGroup = type === 'group';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Pressable style={styles.messageArea} onPress={Keyboard.dismiss}>
        <FlatList
          ref={listRef}
          data={reversed}
          keyExtractor={(item) => item._id}
          inverted
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyRow}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.textFaint} />
              <Text style={styles.empty}>No messages yet — say hello</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.senderId._id === user?._id;
            return (
              <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
                {isGroup && !isMine && (
                  <Text style={styles.senderName}>{item.senderId.fullName}</Text>
                )}
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {item.attachment && (
                    <Pressable
                      style={styles.attachmentChip}
                      onPress={() => onOpenAttachment(item)}
                      disabled={openingId === item._id}
                    >
                      {openingId === item._id ? (
                        <ActivityIndicator size="small" color={isMine ? '#fff' : colors.teal} />
                      ) : (
                        <Ionicons
                          name={iconForMimeType(item.attachment.mimeType)}
                          size={20}
                          color={isMine ? '#fff' : colors.teal}
                        />
                      )}
                      <View style={styles.attachmentInfo}>
                        <Text
                          style={[styles.attachmentName, isMine && styles.bubbleTextMine]}
                          numberOfLines={1}
                        >
                          {item.attachment.fileName}
                        </Text>
                        <Text style={[styles.attachmentSize, isMine && styles.attachmentSizeMine]}>
                          {formatFileSize(item.attachment.size)}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                  {item.text.length > 0 && (
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                      {item.text}
                    </Text>
                  )}
                </View>
                <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                  {formatMessageTime(item.createdAt)}
                </Text>
              </View>
            );
          }}
        />
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={styles.attachButton}
          onPress={onAttach}
          disabled={isAttaching}
        >
          {isAttaching ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Ionicons name="attach" size={22} color={colors.textMuted} />
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (isSending || !draft.trim()) && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={isSending || !draft.trim()}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  messageArea: { flex: 1 },
  list: { padding: 16, gap: 8, flexGrow: 1, justifyContent: 'flex-end' },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 24,
    transform: [{ scaleY: -1 }],
  },
  empty: { fontSize: 13, color: colors.textFaint },
  error: { color: colors.danger, paddingHorizontal: 16, paddingBottom: 4 },
  bubbleRow: { maxWidth: '80%', marginBottom: 4, alignItems: 'flex-start' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  senderName: { fontSize: 11, fontWeight: '600', color: colors.textFaint, marginBottom: 2, marginHorizontal: 4 },
  bubble: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, gap: 6 },
  bubbleTheirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, color: colors.text },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 11, color: colors.textFaint, marginTop: 2, marginHorizontal: 4 },
  bubbleTimeMine: { textAlign: 'right' },
  attachmentChip: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  attachmentInfo: { flex: 1 },
  attachmentName: { fontSize: 13, fontWeight: '600', color: colors.text },
  attachmentSize: { fontSize: 11, color: colors.textFaint, marginTop: 1 },
  attachmentSizeMine: { color: 'rgba(255,255,255,0.8)' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: colors.background,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});

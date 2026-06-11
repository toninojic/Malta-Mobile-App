import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { SendHorizontal, ThumbsUp } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { useConversationMessages, useMarkMessageRead, useSendMessage } from '../../api/messageHooks';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { MessagesStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { ChatMessage } from '../../types/domain';
import { formatChatTimestamp } from '../../utils/date';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationThread'>;
const CHAT_BOTTOM_GAP = 6;
const ANDROID_SUGGESTION_BAR_CLEARANCE = 47;

export function ConversationThreadScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const [content, setContent] = useState('');
  const [keyboardClearance, setKeyboardClearance] = useState(0);
  const messagesQuery = useConversationMessages(route.params.conversationId, isFocused);
  const sendMutation = useSendMessage();
  const markReadMutation = useMarkMessageRead();
  const markedReadIdsRef = useRef(new Set<string>());
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const isNewContactConversation =
    messagesQuery.error instanceof ApiError && messagesQuery.error.status === 404;
  const messages = isNewContactConversation ? [] : messagesQuery.data ?? [];

  useEffect(() => {
    if (isFocused) {
      void messagesQuery.refetch({ cancelRefetch: false });
    }
  }, [isFocused, messagesQuery.refetch]);

  useEffect(() => {
    const unreadIds = messages
      .filter((message) => message.senderId !== user?.id && !message.isRead)
      .map((message) => message.id)
      .filter((messageId) => !markedReadIdsRef.current.has(messageId));

    if (!unreadIds.length) {
      return;
    }

    unreadIds.forEach((messageId) => markedReadIdsRef.current.add(messageId));

    void (async () => {
      for (const messageId of unreadIds) {
        try {
          await markReadMutation.mutateAsync(messageId);
        } catch (error) {
          if (error instanceof ApiError && error.status === 429) {
            return;
          }

          markedReadIdsRef.current.delete(messageId);
        }
      }
    })();
  }, [markReadMutation, messages, user?.id]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardClearance(Platform.OS === 'android' ? ANDROID_SUGGESTION_BAR_CLEARANCE : 0);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardClearance(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const send = (overrideContent?: string) => {
    const nextContent = overrideContent ?? content;
    const trimmed = nextContent.trim();
    if (!trimmed) {
      return;
    }

    sendMutation.mutate(
      { id: route.params.conversationId, content: trimmed },
      {
        onSuccess: (result) => {
          setContent('');
          if (result.conversation.id !== route.params.conversationId) {
            navigation.replace('ConversationThread', { conversationId: result.conversation.id });
          }
        },
        onError: (error) => {
          Alert.alert('Could not send message', error instanceof Error ? error.message : 'Please try again.');
        },
      },
    );
  };

  if (messagesQuery.error && !isNewContactConversation) {
    return (
      <Screen>
        <EmptyState
          icon={SendHorizontal}
          title="Could not load messages"
          message={messagesQuery.error instanceof Error ? messagesQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void messagesQuery.refetch()}
        />
      </Screen>
    );
  }

  const hasMessage = content.trim().length > 0;
  const ComposerIcon = hasMessage ? SendHorizontal : ThumbsUp;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.root}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={messagesQuery.isRefetching}
              onRefresh={() => {
                if (!messagesQuery.isFetching) {
                  void messagesQuery.refetch({ cancelRefetch: false });
                }
              }}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            {
              padding: theme.spacing.lg,
              paddingBottom: CHAT_BOTTOM_GAP,
            },
          ]}
          ListEmptyComponent={
            <EmptyState
              icon={SendHorizontal}
              title="No messages yet"
              message="Start the conversation with a short message."
            />
          }
          renderItem={({ item }) => (
            <MessageBubble key={item.id} message={item} mine={item.senderId === user?.id} />
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
        <View
          style={[
            styles.composer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              marginBottom: keyboardClearance,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={[styles.inputWrap, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Message"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              style={[styles.input, { color: theme.colors.text }]}
              keyboardAppearance={theme.isDark ? 'dark' : 'light'}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasMessage ? 'Send message' : 'Send like'}
            disabled={sendMutation.isPending}
            onPress={() => send(hasMessage ? undefined : '\u{1F44D}')}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: sendMutation.isPending ? 0.55 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <ComposerIcon color="#FFFFFF" size={21} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const theme = useTheme();

  return (
    <Card style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text style={[styles.sender, { color: theme.colors.textMuted }]}>
        {mine ? 'You' : message.sender?.profile?.displayName ?? message.sender?.email ?? 'Contact'}
      </Text>
      <Text style={[styles.message, { color: theme.colors.text }]}>{message.content}</Text>
      <Text style={[styles.status, { color: theme.colors.textMuted }]}>
        {formatChatTimestamp(message.createdAt)}
        {mine ? `  ${message.isRead ? '\u2713\u2713' : '\u2713'}` : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
  },
  mine: {
    alignSelf: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
  },
  sender: {
    fontSize: 12,
    fontWeight: '800',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  status: {
    fontSize: 11,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: {
    minHeight: 40,
    maxHeight: 96,
    fontSize: 16,
    lineHeight: 21,
    paddingVertical: 9,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

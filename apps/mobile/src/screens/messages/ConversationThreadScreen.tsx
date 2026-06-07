import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { SendHorizontal, ThumbsUp } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
const KEYBOARD_CLEARANCE = 6;
const CHAT_BOTTOM_GAP = 6;

export function ConversationThreadScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const [content, setContent] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [composerHeight, setComposerHeight] = useState(72);
  const messagesQuery = useConversationMessages(route.params.conversationId, isFocused);
  const sendMutation = useSendMessage();
  const markReadMutation = useMarkMessageRead();
  const markedReadIdsRef = useRef(new Set<string>());
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const rootRef = useRef<View>(null);
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
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      const setMeasuredOffset = (rootBottom: number) => {
        const overlap = Math.max(0, rootBottom - keyboardTop);
        const nextOffset = overlap > 0 ? overlap + KEYBOARD_CLEARANCE : 0;
        setKeyboardOffset(nextOffset);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      };

      if (rootRef.current) {
        rootRef.current.measureInWindow((_x, y, _width, height) => {
          setMeasuredOffset(y + height);
        });
        return;
      }

      setKeyboardOffset(event.endCoordinates.height + KEYBOARD_CLEARANCE);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardOffset(0));

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
      <View ref={rootRef} style={styles.root}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            {
              padding: theme.spacing.lg,
              paddingBottom: composerHeight + (keyboardOffset > 0 ? keyboardOffset + CHAT_BOTTOM_GAP : CHAT_BOTTOM_GAP),
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
          onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
          style={[
            styles.composer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              bottom: keyboardOffset,
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
      </View>
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
        {mine ? ` / ${message.isRead ? 'read' : 'unread'}` : ''}
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
    position: 'absolute',
    left: 0,
    right: 0,
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

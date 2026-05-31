import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { SendHorizontal } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { useConversationMessages, useMarkMessageRead, useSendMessage } from '../../api/messageHooks';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { MessagesStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { ChatMessage } from '../../types/domain';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationThread'>;

export function ConversationThreadScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const [content, setContent] = useState('');
  const messagesQuery = useConversationMessages(route.params.conversationId, isFocused);
  const sendMutation = useSendMessage();
  const markReadMutation = useMarkMessageRead();
  const markedReadIdsRef = useRef(new Set<string>());
  const isNewContactConversation =
    messagesQuery.error instanceof ApiError && messagesQuery.error.status === 404;
  const messages = isNewContactConversation ? [] : messagesQuery.data ?? [];

  useEffect(() => {
    if (isFocused) {
      void messagesQuery.refetch();
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

  const send = () => {
    const trimmed = content.trim();
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

  return (
    <Screen
      footer={
        <View style={styles.composer}>
          <TextField
            label="Message"
            value={content}
            onChangeText={setContent}
            placeholder="Type a message"
            multiline
            style={styles.input}
          />
          <Button title="Send" icon={SendHorizontal} loading={sendMutation.isPending} onPress={send} />
        </View>
      }
    >
      {messages.length === 0 ? (
        <EmptyState icon={SendHorizontal} title="No messages yet" message="Start the conversation with a short message." />
      ) : null}
      <View style={styles.list}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} mine={message.senderId === user?.id} />
        ))}
      </View>
    </Screen>
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
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {mine ? ` / ${message.isRead ? 'read' : 'unread'}` : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
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
    gap: 10,
  },
  input: {
    maxHeight: 96,
  },
});

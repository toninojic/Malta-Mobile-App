import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MessageCircle, RefreshCw } from 'lucide-react-native';
import { useAdminConversations, useConversations } from '../../api/messageHooks';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { MessagesStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { Conversation } from '../../types/domain';
import { formatDateTime } from '../../utils/date';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const userConversations = useConversations(!isAdmin, isFocused && !isAdmin);
  const adminConversations = useAdminConversations(isAdmin, isFocused && isAdmin);
  const query = isAdmin ? adminConversations : userConversations;

  useFocusEffect(
    useCallback(() => {
      void query.refetch({ cancelRefetch: false });
    }, [query.refetch]),
  );

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => {
        if (!query.isFetching) {
          void query.refetch({ cancelRefetch: false });
        }
      }}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{isAdmin ? 'All conversations' : 'Messages'}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Unlocked contacts become conversations after the first message.</Text>
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load conversations"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data?.data.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations yet" message="Send the first message from an unlocked contact." />
      ) : null}

      <View style={styles.list}>
        {query.data?.data.map((conversation) => (
          <ConversationCard
            key={conversation.id}
            conversation={conversation}
            viewerId={user?.id}
            admin={isAdmin}
            onPress={() => navigation.navigate('ConversationThread', { conversationId: conversation.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

function ConversationCard({
  conversation,
  viewerId,
  admin,
  onPress,
}: {
  conversation: Conversation;
  viewerId?: string;
  admin: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const title = conversation.contactUnlock.jobRequest.title;
  const lastMessage = conversation.lastMessage?.content ?? 'No messages yet';
  const otherParticipant =
    viewerId === conversation.employerId ? conversation.contractor : conversation.employer;
  const participantLabel = admin
    ? `${displayName(conversation.employer)} / ${displayName(conversation.contractor)}`
    : displayName(otherParticipant);
  const lastActivityAt = conversation.lastMessage?.createdAt ?? conversation.lastMessageAt ?? conversation.createdAt;

  return (
    <Card onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.participant, { color: theme.colors.text }]}>
            {participantLabel}
          </Text>
          <Text numberOfLines={2} style={[styles.preview, { color: theme.colors.textMuted }]}>{lastMessage}</Text>
        </View>
        {conversation.unreadCount ? <Badge status={String(conversation.unreadCount)} /> : null}
      </View>
      <View style={styles.cardFooter}>
        <Badge status={conversation.contactUnlock.status} />
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{formatDateTime(lastActivityAt)}</Text>
      </View>
    </Card>
  );
}

function displayName(user: Conversation['employer']) {
  return user.profile?.displayName ?? user.email;
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  center: {
    paddingVertical: 32,
  },
  list: {
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  participant: {
    fontSize: 14,
    fontWeight: '800',
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  meta: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
});

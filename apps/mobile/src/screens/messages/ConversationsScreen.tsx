import { NativeStackScreenProps } from '@react-navigation/native-stack';
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

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const userConversations = useConversations(!isAdmin);
  const adminConversations = useAdminConversations(isAdmin);
  const query = isAdmin ? adminConversations : userConversations;

  return (
    <Screen>
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
            onPress={() => navigation.navigate('ConversationThread', { conversationId: conversation.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

function ConversationCard({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const theme = useTheme();
  const title = conversation.contactUnlock.jobRequest.title;
  const lastMessage = conversation.lastMessage?.content ?? 'No messages yet';

  return (
    <Card onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text numberOfLines={2} style={[styles.preview, { color: theme.colors.textMuted }]}>{lastMessage}</Text>
        </View>
        {conversation.unreadCount ? <Badge status={String(conversation.unreadCount)} /> : null}
      </View>
      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
        {conversation.employer.profile?.displayName ?? conversation.employer.email} / {conversation.contractor.profile?.displayName ?? conversation.contractor.email}
      </Text>
    </Card>
  );
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
  preview: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontSize: 13,
  },
});

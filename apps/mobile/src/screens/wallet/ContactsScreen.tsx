import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { RefreshCw, UsersRound } from 'lucide-react-native';
import { useAdminContacts, useContacts } from '../../api/contactHooks';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { ContactUnlock } from '../../types/domain';

type Props = NativeStackScreenProps<ActivityStackParamList, 'Contacts'>;

export function ContactsScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const contactsQuery = useContacts(!isAdmin);
  const adminContactsQuery = useAdminContacts(isAdmin);
  const query = isAdmin ? adminContactsQuery : contactsQuery;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{isAdmin ? 'Contact unlocks' : 'Unlocked contacts'}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {isAdmin ? 'Review contact unlock relationships across the marketplace.' : 'People you can now contact directly.'}
        </Text>
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load contacts"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data?.data.length === 0 ? (
        <EmptyState icon={UsersRound} title="No contacts yet" message="Unlocked relationships will appear here." />
      ) : null}

      <View style={styles.list}>
        {query.data?.data.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            onPress={() => navigation.navigate('ContactDetails', { contactId: contact.id, admin: isAdmin })}
          />
        ))}
      </View>
    </Screen>
  );
}

function ContactCard({ contact, onPress }: { contact: ContactUnlock; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Card onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{contact.jobRequest.title}</Text>
          <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
            {contact.contractor.profile?.displayName ?? contact.contractor.email} / {contact.employer.profile?.displayName ?? contact.employer.email}
          </Text>
        </View>
        <Badge status={contact.status} />
      </View>
      <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
        EUR {contact.offer.estimatedPrice} / {contact.offer.estimatedCompletionDays} days
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
  cardMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
});

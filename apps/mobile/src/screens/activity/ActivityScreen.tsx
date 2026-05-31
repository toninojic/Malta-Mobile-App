import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, BriefcaseBusiness, ClipboardList, MessageCircle, ShieldCheck, Star, UsersRound } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ActivityHome'>;

export function ActivityScreen({ navigation }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isContractor = user?.role === 'CONTRACTOR';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Activity</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {isContractor
              ? 'Manage offers, unlocked work, completion status, and reviews.'
              : isAdmin
                ? 'Review marketplace operational queues.'
                : 'Track jobs, offers, unlocked contacts, chats, and reviews.'}
          </Text>
        </View>

        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Work</Text>
          {isContractor ? (
            <Button
              title="My Offers"
              icon={ClipboardList}
              onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'MyOffers' })}
            />
          ) : (
            <Button
              title={isAdmin ? 'All Jobs' : 'My Jobs & Offers'}
              icon={BriefcaseBusiness}
              onPress={() => navigation.getParent()?.navigate('JobsTab', { screen: 'EmployerJobs' })}
            />
          )}
          <Button title="Unlocked Contacts" icon={UsersRound} variant="secondary" onPress={() => navigation.navigate('Contacts')} />
          <Button
            title="Messages"
            icon={MessageCircle}
            variant="secondary"
            onPress={() => navigation.getParent()?.navigate('MessagesTab', { screen: 'Conversations' })}
          />
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reviews & alerts</Text>
          {isContractor ? (
            <Button title="My Reviews" icon={Star} onPress={() => navigation.navigate('MyReviews')} />
          ) : null}
          {isAdmin ? (
            <Button title="Review Moderation" icon={ShieldCheck} onPress={() => navigation.navigate('AdminReviews')} />
          ) : null}
          <Button title="Alerts" icon={Bell} variant="secondary" onPress={() => navigation.navigate('NotificationsHome')} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 16,
    padding: 16,
  },
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
});

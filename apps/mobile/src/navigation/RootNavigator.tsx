import {
  DarkTheme,
  DefaultTheme,
  LinkingOptions,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Bell, BriefcaseBusiness, ClipboardList, LayoutDashboard, MessageCircle, ShieldCheck, Star, UserRound, UsersRound, WalletCards } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useActivitySummary } from '../api/activityHooks';
import { useConversations } from '../api/messageHooks';
import { useUnreadNotificationCount } from '../api/notificationHooks';
import { useContractorVerification } from '../api/offerWorkHooks';
import { useContractorRatingSummary } from '../api/reviewHooks';
import { useTheme } from '../design/theme';
import { useActivityUiStore } from '../store/activity.store';
import { useAuthStore } from '../store/auth.store';
import { ActivityScreen } from '../screens/activity/ActivityScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { EmployerJobsScreen } from '../screens/employer/EmployerJobsScreen';
import { JobDetailsScreen } from '../screens/employer/JobDetailsScreen';
import { JobFormScreen } from '../screens/employer/JobFormScreen';
import { MyOffersScreen } from '../screens/contractor/MyOffersScreen';
import { OfferFormScreen } from '../screens/contractor/OfferFormScreen';
import { OfferWorkDetailsScreen } from '../screens/contractor/OfferWorkDetailsScreen';
import { UnlockContactScreen } from '../screens/contractor/UnlockContactScreen';
import { ProfileEditScreen } from '../screens/profile/ProfileEditScreen';
import { AdminRefundDetailsScreen } from '../screens/wallet/AdminRefundDetailsScreen';
import { ContactDetailsScreen } from '../screens/wallet/ContactDetailsScreen';
import { ContactsScreen } from '../screens/wallet/ContactsScreen';
import { PaymentFailedScreen, PaymentPendingScreen, PaymentSuccessScreen } from '../screens/wallet/PaymentStatusScreen';
import { RefundRequestScreen } from '../screens/wallet/RefundRequestScreen';
import { WalletScreen } from '../screens/wallet/WalletScreen';
import { ConversationThreadScreen } from '../screens/messages/ConversationThreadScreen';
import { ConversationsScreen } from '../screens/messages/ConversationsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminJobsScreen } from '../screens/admin/AdminJobsScreen';
import { AdminModerationScreen } from '../screens/admin/AdminModerationScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminReviewsScreen } from '../screens/reviews/AdminReviewsScreen';
import { ContractorProfileScreen } from '../screens/reviews/ContractorProfileScreen';
import { LeaveReviewScreen } from '../screens/reviews/LeaveReviewScreen';
import { MyReviewsScreen } from '../screens/reviews/MyReviewsScreen';
import { ReviewDetailsScreen } from '../screens/reviews/ReviewDetailsScreen';
import {
  AppTabParamList,
  ActivityStackParamList,
  AuthStackParamList,
  JobsStackParamList,
  MessagesStackParamList,
  WalletStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const JobsStack = createNativeStackNavigator<JobsStackParamList>();
const ActivityStack = createNativeStackNavigator<ActivityStackParamList>();
const WalletStack = createNativeStackNavigator<WalletStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

const linking: LinkingOptions<AppTabParamList> = {
  prefixes: ['maltacraftsman://'],
  config: {
    screens: {
      WalletTab: {
        screens: {
          PaymentSuccess: 'payment-success',
          PaymentFailed: 'payment-failed',
          PaymentPending: 'payment-pending',
        },
      },
    },
  },
};

export function RootNavigator() {
  const theme = useTheme();
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const navTheme: Theme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.background,
      card: theme.colors.surface,
      border: theme.colors.border,
      primary: theme.colors.primary,
      text: theme.colors.text,
    },
  };

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={{ marginTop: 12, color: theme.colors.textMuted }}>Preparing your workspace</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      {user ? <AuthenticatedTabs /> : <AuthRoutes />}
    </NavigationContainer>
  );
}

function AuthRoutes() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function JobsRoutes() {
  return (
    <JobsStack.Navigator screenOptions={{ headerRight: () => <HeaderUserSummary /> }}>
      <JobsStack.Screen name="EmployerJobs" component={EmployerJobsScreen} options={{ title: 'Job Requests' }} />
      <JobsStack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
      <JobsStack.Screen name="JobForm" component={JobFormScreen} options={({ route }) => ({ title: route.params?.jobId ? 'Edit Job' : 'Create Job' })} />
      <JobsStack.Screen name="OfferForm" component={OfferFormScreen} options={({ route }) => ({ title: route.params?.offerId ? 'Edit Offer' : 'Create Offer' })} />
      <JobsStack.Screen name="OfferWorkDetails" component={OfferWorkDetailsScreen} options={{ title: 'Offer / Work Details' }} />
      <JobsStack.Screen name="UnlockContact" component={UnlockContactScreen} options={{ title: 'Unlock Contact' }} />
      <JobsStack.Screen name="MyOffers" component={MyOffersScreen} options={{ title: 'My Offers' }} />
    </JobsStack.Navigator>
  );
}

function WalletRoutes() {
  return (
    <WalletStack.Navigator screenOptions={{ headerRight: () => <HeaderUserSummary /> }}>
      <WalletStack.Screen name="WalletHome" component={WalletScreen} options={{ title: 'Wallet' }} />
      <WalletStack.Screen name="RefundRequest" component={RefundRequestScreen} options={{ title: 'Request Refund' }} />
      <WalletStack.Screen name="AdminRefundDetails" component={AdminRefundDetailsScreen} options={{ title: 'Refund Details' }} />
      <WalletStack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} options={{ title: 'Payment' }} />
      <WalletStack.Screen name="PaymentFailed" component={PaymentFailedScreen} options={{ title: 'Payment' }} />
      <WalletStack.Screen name="PaymentPending" component={PaymentPendingScreen} options={{ title: 'Payment' }} />
    </WalletStack.Navigator>
  );
}

function ActivityRoutes() {
  return (
    <ActivityStack.Navigator screenOptions={{ headerRight: () => <HeaderUserSummary /> }}>
      <ActivityStack.Screen name="ActivityHome" component={ActivityScreen} options={{ title: 'Activity' }} />
      <ActivityStack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Contacts' }} />
      <ActivityStack.Screen name="ContactDetails" component={ContactDetailsScreen} options={{ title: 'Contact Details' }} />
      <ActivityStack.Screen name="LeaveReview" component={LeaveReviewScreen} options={{ title: 'Leave Review' }} />
      <ActivityStack.Screen name="ReviewDetails" component={ReviewDetailsScreen} options={{ title: 'Review Details' }} />
      <ActivityStack.Screen name="MyReviews" component={MyReviewsScreen} options={{ title: 'My Reviews' }} />
      <ActivityStack.Screen name="ContractorProfile" component={ContractorProfileScreen} options={{ title: 'Contractor Profile' }} />
      <ActivityStack.Screen name="AdminReviews" component={AdminReviewsScreen} options={{ title: 'Review Moderation' }} />
      <ActivityStack.Screen name="NotificationsHome" component={NotificationsScreen} options={{ title: 'Alerts' }} />
    </ActivityStack.Navigator>
  );
}

function MessagesRoutes() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerRight: () => <HeaderUserSummary /> }}>
      <MessagesStack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Messages' }} />
      <MessagesStack.Screen name="ConversationThread" component={ConversationThreadScreen} options={{ title: 'Conversation' }} />
    </MessagesStack.Navigator>
  );
}

function HeaderUserSummary() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isContractor = user?.role === 'CONTRACTOR';
  const ratingQuery = useContractorRatingSummary(isContractor ? user?.id : undefined);
  const verificationQuery = useContractorVerification(isContractor);
  const displayName = user?.profile?.displayName ?? user?.email ?? '';
  const totalReviews = ratingQuery.data?.totalReviews ?? 0;
  const averageRating = ratingQuery.data?.averageRating ? Number(ratingQuery.data.averageRating).toFixed(1) : null;
  const verified = verificationQuery.data?.status === 'VERIFIED';

  if (!user || user.role === 'ADMIN') {
    return null;
  }

  return (
    <View style={styles.headerSummary}>
      <Text numberOfLines={1} style={[styles.headerName, { color: theme.colors.text }]}>{displayName}</Text>
      {isContractor && totalReviews > 0 && averageRating ? (
        <View style={styles.headerMetric}>
          <Star color={theme.colors.warning} size={13} />
          <Text style={[styles.headerMeta, { color: theme.colors.textMuted }]}>{averageRating}</Text>
        </View>
      ) : null}
      {isContractor && verified ? <ShieldCheck color={theme.colors.success} size={15} /> : null}
    </View>
  );
}

function AuthenticatedTabs() {
  const user = useAuthStore((state) => state.user);

  if (user?.role === 'ADMIN') {
    return <AdminTabs />;
  }

  return <UserTabs />;
}

function UserTabs() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const viewedContractorActionCount = useActivityUiStore((state) =>
    user?.id ? state.viewedContractorActionCounts[user.id] ?? 0 : 0,
  );
  const conversationsQuery = useConversations();
  const notificationsCountQuery = useUnreadNotificationCount(user?.role === 'EMPLOYER', true);
  const activitySummaryQuery = useActivitySummary(user?.role === 'CONTRACTOR', true);
  const unreadMessages =
    conversationsQuery.data?.data.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0;
  const unreadNotifications = notificationsCountQuery.data?.count ?? 0;
  const currentContractorActionCount =
    activitySummaryQuery.data?.role === 'CONTRACTOR'
      ? activitySummaryQuery.data.selectedOffersCount + activitySummaryQuery.data.jobsInProgressCount
      : 0;
  const contractorActivityBadge = Math.max(currentContractorActionCount - viewedContractorActionCount, 0);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="JobsTab"
        component={JobsRoutes}
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => <BriefcaseBusiness color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ActivityTab"
        component={ActivityRoutes}
        options={{
          title: 'Activity',
          tabBarBadge: user?.role === 'CONTRACTOR' ? contractorActivityBadge || undefined : undefined,
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="MessagesTab"
        component={MessagesRoutes}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate('MessagesTab', { screen: 'Conversations' });
          },
        })}
        options={{
          title: 'Messages',
          tabBarBadge: unreadMessages || undefined,
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      {user?.role === 'EMPLOYER' ? (
        <Tabs.Screen
          name="AlertsTab"
          component={NotificationsScreen}
          options={{
            title: 'Alerts',
            tabBarBadge: unreadNotifications || undefined,
            tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          }}
        />
      ) : (
        <Tabs.Screen
          name="WalletTab"
          component={WalletRoutes}
          options={{
            title: 'Wallet',
            tabBarIcon: ({ color, size }) => <WalletCards color={color} size={size} />,
          }}
        />
      )}
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileEditScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs.Navigator>
  );
}

function AdminTabs() {
  const theme = useTheme();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="AdminDashboardTab"
        component={AdminDashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="AdminUsersTab"
        component={AdminUsersScreen}
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="AdminJobsTab"
        component={AdminJobsScreen}
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => <BriefcaseBusiness color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="AdminModerationTab"
        component={AdminModerationScreen}
        options={{
          title: 'Moderation',
          tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileEditScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  headerSummary: {
    maxWidth: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  headerName: {
    maxWidth: 110,
    fontSize: 13,
    fontWeight: '800',
  },
  headerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerMeta: {
    fontSize: 12,
    fontWeight: '800',
  },
});

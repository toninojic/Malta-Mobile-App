import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Building2, Flag, Mail, MapPin, Phone, RefreshCw, ShieldCheck, Star } from 'lucide-react-native';
import { ComponentType, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useContractorProfile, useContractorReviews } from '../../api/reviewHooks';
import { EmptyState } from '../../components/EmptyState';
import { AppModal } from '../../components/AppModal';
import { Button } from '../../components/Button';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { RatingSummaryCard } from '../../components/reviews/RatingSummaryCard';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ContractorProfile'>;

export function ContractorProfileScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const profileQuery = useContractorProfile(route.params.contractorId);
  const reviewsQuery = useContractorReviews(route.params.contractorId);
  const user = useAuthStore((state) => state.user);
  const [portfolioViewerIndex, setPortfolioViewerIndex] = useState(0);
  const [portfolioViewerOpen, setPortfolioViewerOpen] = useState(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [verifiedInfoOpen, setVerifiedInfoOpen] = useState(false);
  const contractor = profileQuery.data;
  const profile = contractor?.profile;
  const displayName = profile?.displayName ?? (contractor?.canSeePrivateDetails ? contractor.email : 'Contractor');

  return (
    <Screen
      refreshing={profileQuery.isRefetching || reviewsQuery.isRefetching}
      onRefresh={() => {
        if (!profileQuery.isFetching) void profileQuery.refetch({ cancelRefetch: false });
        if (!reviewsQuery.isFetching) void reviewsQuery.refetch({ cancelRefetch: false });
      }}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Contractor profile</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {contractor?.canSeePrivateDetails
            ? 'Full profile, contact details, portfolio, and completed job reviews.'
            : 'Public rating, verification, portfolio, and completed job reviews.'}
        </Text>
      </View>

      {profileQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {profileQuery.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load contractor profile"
          message={profileQuery.error instanceof Error ? profileQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void profileQuery.refetch()}
        />
      ) : null}

      {contractor ? (
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.identityRow}>
            {profile?.avatarUrl ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Preview contractor avatar"
                onPress={() => setAvatarViewerOpen(true)}
              >
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              </Pressable>
            ) : null}
            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
                {contractor.verificationStatus === 'VERIFIED' ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Verified contractor information" hitSlop={8} onPress={() => setVerifiedInfoOpen(true)}>
                    <ShieldCheck color={theme.colors.success} size={18} />
                  </Pressable>
                ) : null}
              </View>
              {profile?.location ? (
                <InfoLine icon={MapPin} text={profile.location} />
              ) : null}
            </View>
          </View>

          {contractor.canSeePrivateDetails ? (
            <View style={styles.infoList}>
              {contractor.email ? <InfoLine icon={Mail} text={contractor.email} /> : null}
              {profile?.phone ? <InfoLine icon={Phone} text={profile.phone} /> : null}
              {profile?.companyName ? <InfoLine icon={Building2} text={profile.companyName} /> : null}
              {profile?.bio ? <Text style={[styles.bio, { color: theme.colors.textMuted }]}>{profile.bio}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
      <ImageViewerModal
        images={profile?.avatarUrl ? [{ id: 'avatar', url: profile.avatarUrl }] : []}
        initialIndex={0}
        visible={avatarViewerOpen}
        onClose={() => setAvatarViewerOpen(false)}
      />
      <AppModal
        visible={verifiedInfoOpen}
        title="Verified Contractor"
        body="This contractor has submitted verification documents that were reviewed and approved by the MaltaPro admin team."
        icon={ShieldCheck}
        actions={[{ label: 'Close', variant: 'primary', onPress: () => setVerifiedInfoOpen(false) }]}
        onRequestClose={() => setVerifiedInfoOpen(false)}
      />

      <RatingSummaryCard summary={contractor?.ratingSummary ?? undefined} />

      {contractor?.portfolioImages.length ? (
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Portfolio</Text>
          <View style={styles.portfolio}>
            {contractor.portfolioImages.map((image, index) => (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={`Open portfolio image ${index + 1}`}
                key={image.id}
                onPress={() => {
                  setPortfolioViewerIndex(index);
                  setPortfolioViewerOpen(true);
                }}
              >
                <Image source={{ uri: image.url }} style={styles.portfolioImage} />
              </Pressable>
            ))}
          </View>
          <ImageViewerModal
            images={contractor.portfolioImages.map((image) => ({ id: image.id, url: image.url }))}
            initialIndex={portfolioViewerIndex}
            visible={portfolioViewerOpen}
            onClose={() => setPortfolioViewerOpen(false)}
          />
        </View>
      ) : null}

      {reviewsQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {reviewsQuery.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load profile"
          message={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void reviewsQuery.refetch()}
        />
      ) : null}

      {reviewsQuery.data?.data.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" message="This contractor has no active reviews yet." />
      ) : null}

      <View style={styles.list}>
        {reviewsQuery.data?.data.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onPress={() => navigation.navigate('ReviewDetails', { reviewId: review.id })}
          />
        ))}
      </View>
      {contractor && user?.id !== route.params.contractorId ? (
        <Button
          title="Report Contractor"
          icon={Flag}
          variant="secondary"
          onPress={() =>
            navigation.navigate('ReportForm', {
              targetType: 'USER',
              targetId: route.params.contractorId,
              targetSummary: displayName,
            })
          }
        />
      ) : null}
    </Screen>
  );
}

function InfoLine({ icon: Icon, text }: { icon: ComponentType<{ color?: string; size?: number }>; text: string }) {
  const theme = useTheme();

  return (
    <View style={styles.infoLine}>
      <Icon color={theme.colors.textMuted} size={16} />
      <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>{text}</Text>
    </View>
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
    paddingVertical: 24,
  },
  profileCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    borderRadius: 28,
    height: 56,
    width: 56,
  },
  identityCopy: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
  },
  infoList: {
    gap: 8,
  },
  infoLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  portfolio: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portfolioImage: {
    borderRadius: 8,
    height: 86,
    width: 86,
  },
  list: {
    gap: 12,
  },
});

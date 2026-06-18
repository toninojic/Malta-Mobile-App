import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { BellRing, ChevronDown, ChevronRight, ImagePlus, LogOut, RefreshCw, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../../api/client';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../../api/notificationHooks';
import {
  useContractorVerification,
  useContractorServiceAreas,
  useContractorServiceCategories,
  usePortfolioImages,
  useRemovePortfolioImage,
  useUpdateContractorServiceAreas,
  useUpdateContractorServiceCategories,
  useUploadContractorVerification,
  useUploadPortfolioImages,
} from '../../api/offerWorkHooks';
import { useEmployerRatingSummary } from '../../api/reviewHooks';
import { Badge } from '../../components/Badge';
import { AppModal } from '../../components/AppModal';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { MALTA_SERVICE_LOCATIONS } from '../../config/maltaLocations';
import { SERVICE_CATEGORIES, serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { AppearanceMode, useAppearanceStore } from '../../store/appearance.store';
import { useAuthStore } from '../../store/auth.store';
import {
  deactivateCurrentDevicePushToken,
  getPushRegistrationDiagnostics,
  maskPushToken,
  registerExpoPushTokenForUser,
  shouldShowPushDiagnostics,
  subscribePushRegistrationDiagnostics,
} from '../../services/pushNotifications';
import { AuthUser, NotificationPreferences, UserProfile } from '../../types/domain';

type SelectedAvatar = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  uploaded: boolean;
};

type PreferenceToggleKey = keyof Pick<
  NotificationPreferences,
  | 'messages'
  | 'offerUpdates'
  | 'reviews'
  | 'paymentsRefunds'
  | 'newJobsNearMe'
  | 'systemAlerts'
  | 'adminAlerts'
>;

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ProfileEditScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const currentUser = useAuthStore((state) => state.user);
  const appearanceMode = useAppearanceStore((state) => state.mode);
  const setAppearanceMode = useAppearanceStore((state) => state.setMode);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [avatarKey, setAvatarKey] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarImage, setAvatarImage] = useState<SelectedAvatar | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [tradeCategories, setTradeCategories] = useState('');
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [profileSavedOpen, setProfileSavedOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [notificationSettingsExpanded, setNotificationSettingsExpanded] = useState(false);
  const [serviceAreasExpanded, setServiceAreasExpanded] = useState(false);
  const [serviceCategoriesExpanded, setServiceCategoriesExpanded] = useState(false);
  const [expandedServiceCategoryKeys, setExpandedServiceCategoryKeys] = useState<string[]>([]);
  const [serviceLocationSearch, setServiceLocationSearch] = useState('');
  const [notificationSettingsError, setNotificationSettingsError] = useState<string | null>(null);
  const [serviceAreasError, setServiceAreasError] = useState<string | null>(null);
  const [serviceCategoriesError, setServiceCategoriesError] = useState<string | null>(null);
  const [pushDiagnostics, setPushDiagnostics] = useState(getPushRegistrationDiagnostics());
  const [pushRetrying, setPushRetrying] = useState(false);
  const pushDiagnosticsEnabled = shouldShowPushDiagnostics();

  const query = useQuery({
    queryKey: ['users', 'me'],
    queryFn: api.profile,
  });
  const portfolioQuery = usePortfolioImages(currentUser?.role === 'CONTRACTOR');
  const verificationQuery = useContractorVerification(currentUser?.role === 'CONTRACTOR');
  const notificationPreferencesQuery = useNotificationPreferences(Boolean(currentUser));
  const pushDebugTokensQuery = useQuery({
    queryKey: ['notifications', 'debug', 'push-tokens'],
    queryFn: api.notificationDebugPushTokens,
    enabled: pushDiagnosticsEnabled && notificationSettingsExpanded && Boolean(currentUser),
    staleTime: 5_000,
  });
  const sendTestPushMutation = useMutation({
    mutationFn: api.sendTestPushNotification,
    onSuccess: async () => {
      await pushDebugTokensQuery.refetch();
    },
  });
  const updateNotificationPreferencesMutation = useUpdateNotificationPreferences();
  const serviceAreasQuery = useContractorServiceAreas(currentUser?.role === 'CONTRACTOR');
  const serviceCategoriesQuery = useContractorServiceCategories(currentUser?.role === 'CONTRACTOR');
  const updateServiceAreasMutation = useUpdateContractorServiceAreas();
  const updateServiceCategoriesMutation = useUpdateContractorServiceCategories();
  const employerRatingQuery = useEmployerRatingSummary(currentUser?.role === 'EMPLOYER' ? currentUser.id : undefined);
  const uploadPortfolioMutation = useUploadPortfolioImages();
  const removePortfolioMutation = useRemovePortfolioImage();
  const uploadVerificationMutation = useUploadContractorVerification();

  useEffect(() => {
    const profile = query.data?.profile;
    if (!profile) {
      return;
    }

    setDisplayName(profile.displayName ?? '');
    setPhone(profile.phone ?? '');
    setLocation(profile.location ?? '');
    setBio(profile.bio ?? '');
    setAvatarKey(profile.avatarKey ?? stableAvatarReference(profile.avatarUrl));
    setAvatarUrl(profile.avatarUrl ?? '');
    setAvatarImage(null);
    setCompanyName(profile.companyName ?? '');
    setTradeCategories(profile.tradeCategories?.join(', ') ?? '');
  }, [query.data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let nextAvatarKey = avatarKey;

      if (avatarImage && !avatarImage.uploaded) {
        const uploadedProfile = await api.uploadAvatar(avatarImage);
        nextAvatarKey = uploadedProfile.avatarKey ?? uploadedProfile.avatarUrl ?? '';
      }

      const trimmedAvatarKey = nextAvatarKey.trim();

      return api.updateProfile({
        displayName,
        phone,
        location,
        bio,
        ...(trimmedAvatarKey ? { avatarKey: trimmedAvatarKey } : {}),
        companyName,
        tradeCategories: tradeCategories
          .split(',')
          .map((category) => category.trim())
          .filter(Boolean),
      });
    },
    onSuccess: async (profile) => {
      const nextUser = {
        ...(currentUser as AuthUser),
        profile: profile as UserProfile,
      };
      await updateUser(nextUser);
      setAvatarKey(profile.avatarKey ?? stableAvatarReference(profile.avatarUrl));
      setAvatarUrl(profile.avatarUrl ?? '');
      setAvatarImage(null);
      await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      setProfileSavedOpen(true);
    },
    onError: (error) => {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Please check the form.');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSettled: async () => {
      await deactivateCurrentDevicePushToken();
      await clearSession();
      queryClient.clear();
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: async () => {
      setDeleteAccountOpen(false);
      await clearSession();
      queryClient.clear();
    },
    onError: (error) => {
      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
    },
  });

  const role = query.data?.role ?? currentUser?.role;
  const canUploadAvatar = role === 'EMPLOYER' || role === 'CONTRACTOR';
  const avatarPreviewUri = avatarImage?.uri ?? avatarUrl;
  const isContractor = role === 'CONTRACTOR';
  const isEmployer = role === 'EMPLOYER';
  const selectedLocationKeys = serviceAreasQuery.data?.locations.map((locationItem) => locationItem.locationKey) ?? [];
  const selectedCategoryKeys =
    serviceCategoriesQuery.data?.categories.map((item) => `${item.categoryKey}:${item.subcategoryKey ?? ''}`) ?? [];
  const availableServiceLocations = serviceAreasQuery.data?.availableLocations ?? MALTA_SERVICE_LOCATIONS;
  const filteredServiceLocations = availableServiceLocations.filter((locationItem) => {
    const queryText = serviceLocationSearch.trim().toLowerCase();
    return !queryText || locationItem.label.toLowerCase().includes(queryText) || locationItem.key.includes(queryText);
  });
  const notificationSettingsStatus = updateNotificationPreferencesMutation.isPending
    ? 'Saving'
    : notificationPreferencesQuery.isLoading
      ? 'Loading'
      : notificationPreferencesQuery.isError
        ? 'Error'
        : 'Ready';
  const serviceAreasStatus = updateServiceAreasMutation.isPending
    ? 'Saving'
    : serviceAreasQuery.isLoading
      ? 'Loading'
      : serviceAreasQuery.isError
        ? 'Error'
        : `${selectedLocationKeys.length} selected`;
  const serviceCategoriesStatus = updateServiceCategoriesMutation.isPending
    ? 'Saving'
    : serviceCategoriesQuery.isLoading
      ? 'Loading'
      : serviceCategoriesQuery.isError
        ? 'Error'
        : `${selectedCategoryKeys.length} selected`;

  useEffect(() => {
    if (notificationPreferencesQuery.error) {
      const message = readableError(notificationPreferencesQuery.error);
      setNotificationSettingsError(message);
      logProfileSettingsFailure('notification preferences load failed', notificationPreferencesQuery.error);
    }
  }, [notificationPreferencesQuery.error]);

  useEffect(() => {
    if (!pushDiagnosticsEnabled) {
      return undefined;
    }

    return subscribePushRegistrationDiagnostics(setPushDiagnostics);
  }, [pushDiagnosticsEnabled]);

  useEffect(() => {
    if (serviceAreasQuery.error) {
      const message = readableError(serviceAreasQuery.error);
      setServiceAreasError(message);
      logProfileSettingsFailure('service locations load failed', serviceAreasQuery.error);
    }
  }, [serviceAreasQuery.error]);

  useEffect(() => {
    if (serviceCategoriesQuery.error) {
      const message = readableError(serviceCategoriesQuery.error);
      setServiceCategoriesError(message);
      logProfileSettingsFailure('service categories load failed', serviceCategoriesQuery.error);
    }
  }, [serviceCategoriesQuery.error]);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset) {
      return;
    }

    const type = asset.mimeType ?? mimeTypeFromUri(asset.uri);
    if (!ALLOWED_AVATAR_TYPES.includes(type)) {
      Alert.alert('Unsupported image', 'Only jpg, jpeg, png, and webp images are allowed.');
      return;
    }

    if (asset.fileSize && asset.fileSize > MAX_AVATAR_SIZE) {
      Alert.alert('Image too large', 'Avatar image must be 5MB or smaller.');
      return;
    }

    setAvatarImage({
      uri: asset.uri,
      name: asset.fileName ?? `avatar-${Date.now()}.${extensionFromMimeType(type)}`,
      type,
      size: asset.fileSize,
      uploaded: false,
    });
  };

  const updatePreference = (key: PreferenceToggleKey, value: boolean) => {
    setNotificationSettingsError(null);
    updateNotificationPreferencesMutation.mutate(
      { [key]: value },
      {
        onError: (error) => {
          const message = readableError(error);
          setNotificationSettingsError(message);
          logProfileSettingsFailure('notification preferences save failed', error);
        },
      },
    );
  };

  const retryPushRegistration = async () => {
    if (!currentUser || pushRetrying) {
      return;
    }

    setPushRetrying(true);
    try {
      await registerExpoPushTokenForUser(currentUser);
      await pushDebugTokensQuery.refetch();
    } finally {
      setPushRetrying(false);
    }
  };

  const toggleServiceLocation = (locationKey: string) => {
    if (updateServiceAreasMutation.isPending) {
      return;
    }

    const current = new Set(selectedLocationKeys);
    if (current.has(locationKey)) {
      current.delete(locationKey);
    } else {
      current.add(locationKey);
    }
    setServiceAreasError(null);
    updateServiceAreasMutation.mutate([...current], {
      onError: (error) => {
        const message = readableError(error);
        setServiceAreasError(message);
        logProfileSettingsFailure('service locations save failed', error);
      },
    });
  };

  const toggleServiceCategory = (categoryKey: string, subcategoryKey?: string | null) => {
    if (updateServiceCategoriesMutation.isPending) {
      return;
    }

    const id = `${categoryKey}:${subcategoryKey ?? ''}`;
    const current = new Set(selectedCategoryKeys);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    setServiceCategoriesError(null);
    updateServiceCategoriesMutation.mutate(
      [...current].flatMap((value) => {
        const [nextCategoryKey, nextSubcategoryKey] = value.split(':');
        if (!nextCategoryKey) {
          return [];
        }
        return {
          categoryKey: nextCategoryKey,
          subcategoryKey: nextSubcategoryKey || null,
        };
      }),
      {
        onError: (error) => {
          const message = readableError(error);
          setServiceCategoriesError(message);
          logProfileSettingsFailure('service categories save failed', error);
        },
      },
    );
  };

  const toggleCategoryExpanded = (categoryKey: string) => {
    setExpandedServiceCategoryKeys((current) =>
      current.includes(categoryKey) ? current.filter((key) => key !== categoryKey) : [...current, categoryKey],
    );
  };

  const pickPortfolioImages = async () => {
    const existingCount = portfolioQuery.data?.length ?? 0;
    const remaining = 10 - existingCount;
    if (remaining <= 0) {
      Alert.alert('Portfolio full', 'You can add up to 10 portfolio images.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose portfolio images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const images = result.assets.slice(0, remaining).map((asset, index) => {
      const type = asset.mimeType ?? mimeTypeFromUri(asset.uri);
      return {
        uri: asset.uri,
        name: asset.fileName ?? `portfolio-${Date.now()}-${index}.${extensionFromMimeType(type)}`,
        type,
        size: asset.fileSize,
        uploaded: false,
      };
    });

    const invalid = images.find((image) => !ALLOWED_AVATAR_TYPES.includes(image.type) || (image.size && image.size > MAX_AVATAR_SIZE));
    if (invalid) {
      Alert.alert('Unsupported image', 'Portfolio images must be jpg, jpeg, png, or webp and 5MB or smaller.');
      return;
    }

    uploadPortfolioMutation.mutate(images, {
      onError: (error) => Alert.alert('Could not upload portfolio', error instanceof Error ? error.message : 'Please try again.'),
    });
  };

  const pickVerificationDocument = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose a verification document image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const type = asset.mimeType ?? mimeTypeFromUri(asset.uri);
    if (!ALLOWED_AVATAR_TYPES.includes(type)) {
      Alert.alert('Unsupported document', 'Use jpg, jpeg, png, or webp from the app. PDF is accepted by the API for admin imports.');
      return;
    }
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert('Document too large', 'Verification document must be 10MB or smaller.');
      return;
    }

    uploadVerificationMutation.mutate(
      {
        uri: asset.uri,
        name: asset.fileName ?? `verification-${Date.now()}.${extensionFromMimeType(type)}`,
        type,
      },
      {
        onError: (error) => Alert.alert('Could not upload verification', error instanceof Error ? error.message : 'Please try again.'),
      },
    );
  };

  return (
    <Screen
      contentTopPadding={44}
      refreshing={
        query.isRefetching ||
        portfolioQuery.isRefetching ||
        verificationQuery.isRefetching ||
        employerRatingQuery.isRefetching ||
        notificationPreferencesQuery.isRefetching ||
        serviceAreasQuery.isRefetching ||
        serviceCategoriesQuery.isRefetching
      }
      onRefresh={() => {
        void query.refetch();
        void notificationPreferencesQuery.refetch();
        if (isContractor) {
          void portfolioQuery.refetch();
          void verificationQuery.refetch();
          void serviceAreasQuery.refetch();
          void serviceCategoriesQuery.refetch();
        }
        if (isEmployer) {
          void employerRatingQuery.refetch();
        }
      }}
    >
      <AppModal
        visible={profileSavedOpen}
        title="Profile Saved"
        body="Your profile has been updated."
        icon={Save}
        actions={[{ label: 'Close', variant: 'primary', onPress: () => setProfileSavedOpen(false) }]}
        onRequestClose={() => setProfileSavedOpen(false)}
      />
      <AppModal
        visible={deleteAccountOpen}
        title="Delete Account"
        body="Your account will be deactivated and you will be signed out. Existing jobs, offers, messages, wallet records, and reviews are retained for marketplace history and admin audit."
        icon={Trash2}
        actions={[
          { label: 'Cancel', onPress: () => setDeleteAccountOpen(false), disabled: deleteAccountMutation.isPending },
          {
            label: 'Delete Account',
            variant: 'danger',
            disabled: deleteAccountMutation.isPending,
            onPress: () => deleteAccountMutation.mutate(),
          },
        ]}
        onRequestClose={() => {
          if (!deleteAccountMutation.isPending) {
            setDeleteAccountOpen(false);
          }
        }}
      />
      <Card style={styles.profileTopCard}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole={avatarPreviewUri ? 'imagebutton' : undefined}
            accessibilityLabel={avatarPreviewUri ? 'Preview avatar' : undefined}
            disabled={!avatarPreviewUri}
            onPress={() => setAvatarViewerOpen(true)}
            style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
          >
            {avatarPreviewUri ? (
              <Image source={{ uri: avatarPreviewUri }} style={styles.avatarImage} />
            ) : (
              <UserRound color="#FFFFFF" size={28} />
            )}
          </Pressable>
          <ImageViewerModal
            images={avatarPreviewUri ? [{ id: 'avatar', url: avatarPreviewUri }] : []}
            initialIndex={0}
            visible={avatarViewerOpen}
            onClose={() => setAvatarViewerOpen(false)}
          />
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: theme.colors.text }]}>{displayName || currentUser?.email}</Text>
            <Text style={[styles.email, { color: theme.colors.textMuted }]}>{query.data?.email ?? currentUser?.email}</Text>
          </View>
          {role ? <Badge status={role} /> : null}
        </View>
      </Card>

      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Location" value={location} onChangeText={setLocation} />
      <TextField label="Bio" value={bio} onChangeText={setBio} multiline />
      {canUploadAvatar ? (
        <Button title={avatarPreviewUri ? 'Replace Avatar' : 'Choose Avatar'} icon={ImagePlus} variant="secondary" onPress={pickAvatar} />
      ) : null}
      <TextField label="Company name" value={companyName} onChangeText={setCompanyName} />
      <TextField label="Trade categories" value={tradeCategories} onChangeText={setTradeCategories} />

      {isEmployer && employerRatingQuery.data?.totalReviews ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Employer rating</Text>
          <Text style={[styles.email, { color: theme.colors.textMuted }]}>
            {Number(employerRatingQuery.data.averageRating).toFixed(1)} average from {employerRatingQuery.data.totalReviews}{' '}
            {employerRatingQuery.data.totalReviews === 1 ? 'review' : 'reviews'}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
        <View style={styles.appearanceOptions}>
          {appearanceOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => void setAppearanceMode(option.value)}
              style={[
                styles.appearanceOption,
                {
                  backgroundColor: appearanceMode === option.value ? theme.colors.success : theme.colors.surfaceMuted,
                  borderColor: appearanceMode === option.value ? theme.colors.success : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.appearanceOptionText,
                  { color: appearanceMode === option.value ? '#FFFFFF' : theme.colors.text },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => setNotificationSettingsExpanded((value) => !value)}
          style={styles.accordionHeader}
        >
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notification Settings</Text>
            <Text style={[styles.email, { color: theme.colors.textMuted }]}>{notificationSettingsStatus}</Text>
          </View>
          {notificationSettingsExpanded ? (
            <ChevronDown color={theme.colors.textMuted} size={20} />
          ) : (
            <ChevronRight color={theme.colors.textMuted} size={20} />
          )}
        </Pressable>
        {notificationSettingsExpanded ? (
          <View style={styles.preferenceList}>
            {notificationSettingsError ? (
              <Text style={[styles.errorText, { color: theme.colors.danger }]}>{notificationSettingsError}</Text>
            ) : null}
            {notificationPreferencesQuery.isLoading ? (
              <Text style={[styles.email, { color: theme.colors.textMuted }]}>Loading notification settings...</Text>
            ) : null}
            {notificationPreferenceOptions(role).map((option) => (
              <View key={option.key} style={styles.preferenceRow}>
                <View style={styles.preferenceText}>
                  <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>{option.label}</Text>
                  <Text style={[styles.preferenceDescription, { color: theme.colors.textMuted }]}>{option.description}</Text>
                </View>
                <Switch
                  value={Boolean(notificationPreferencesQuery.data?.[option.key])}
                  disabled={notificationPreferencesQuery.isLoading || updateNotificationPreferencesMutation.isPending}
                  trackColor={{ false: theme.colors.border, true: theme.colors.success }}
                  thumbColor="#FFFFFF"
                  onValueChange={(value) => updatePreference(option.key, value)}
                />
              </View>
            ))}
            {pushDiagnosticsEnabled ? (
              <View style={[styles.pushDebugBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderText}>
                    <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>Push diagnostics</Text>
                    <Text style={[styles.preferenceDescription, { color: theme.colors.textMuted }]}>
                      Temporary registration status for this device.
                    </Text>
                  </View>
                  <BellRing color={theme.colors.success} size={20} />
                </View>
                <DebugRow label="Permission" value={`${pushDiagnostics.permissionStatus ?? 'unknown'} (${pushDiagnostics.permissionGranted ? 'granted' : 'not granted'})`} />
                <DebugRow label="Project ID" value={pushDiagnostics.projectId ?? 'missing'} />
                <DebugRow label="Expo token" value={maskPushToken(pushDiagnostics.expoPushToken)} />
                <DebugRow label="Backend" value={pushDiagnostics.backendRegistrationStatus} />
                {pushDiagnostics.backendResponse ? <DebugRow label="Response" value={pushDiagnostics.backendResponse} /> : null}
                {pushDiagnostics.backendError ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{pushDiagnostics.backendError}</Text> : null}
                <DebugRow
                  label="Saved tokens"
                  value={
                    pushDebugTokensQuery.isLoading
                      ? 'loading'
                      : pushDebugTokensQuery.error
                        ? readableError(pushDebugTokensQuery.error)
                        : `${pushDebugTokensQuery.data?.activeCount ?? 0} active / ${pushDebugTokensQuery.data?.count ?? 0} total`
                  }
                />
                {sendTestPushMutation.data ? (
                  <DebugRow
                    label="Test push"
                    value={
                      sendTestPushMutation.data.message ??
                      `${sendTestPushMutation.data.sent}/${sendTestPushMutation.data.tokenCount} accepted by Expo`
                    }
                  />
                ) : null}
                {sendTestPushMutation.error ? (
                  <Text style={[styles.errorText, { color: theme.colors.danger }]}>
                    {readableError(sendTestPushMutation.error)}
                  </Text>
                ) : null}
                <View style={styles.pushDebugActions}>
                  <Button
                    title="Retry"
                    icon={RefreshCw}
                    variant="secondary"
                    loading={pushRetrying}
                    onPress={retryPushRegistration}
                  />
                  <Button
                    title="Test Push"
                    icon={BellRing}
                    variant="secondary"
                    loading={sendTestPushMutation.isPending}
                    onPress={() => sendTestPushMutation.mutate()}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      {isContractor ? (
        <Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => setServiceAreasExpanded((value) => !value)}
            style={styles.accordionHeader}
          >
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Service Locations</Text>
              <Text style={[styles.email, { color: theme.colors.textMuted }]}>
                {serviceAreasStatus}
              </Text>
            </View>
            {serviceAreasExpanded ? (
              <ChevronDown color={theme.colors.textMuted} size={20} />
            ) : (
              <ChevronRight color={theme.colors.textMuted} size={20} />
            )}
          </Pressable>
          {serviceAreasExpanded ? (
            <View style={styles.expandedSection}>
              <Text style={[styles.email, { color: theme.colors.textMuted }]}>Used for nearby job alerts.</Text>
              {serviceAreasError ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{serviceAreasError}</Text> : null}
              <TextField label="Search locations" value={serviceLocationSearch} onChangeText={setServiceLocationSearch} />
              {serviceAreasQuery.isLoading ? (
                <Text style={[styles.email, { color: theme.colors.textMuted }]}>Loading service locations...</Text>
              ) : null}
              <View style={styles.choiceGrid}>
                {filteredServiceLocations.map((locationItem) => {
                  const selected = selectedLocationKeys.includes(locationItem.key);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={updateServiceAreasMutation.isPending}
                      key={locationItem.key}
                      onPress={() => toggleServiceLocation(locationItem.key)}
                      style={[
                        styles.choicePill,
                        updateServiceAreasMutation.isPending && styles.disabledChoice,
                        {
                          backgroundColor: selected ? theme.colors.success : theme.colors.surfaceMuted,
                          borderColor: selected ? theme.colors.success : theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.choiceText, { color: selected ? '#FFFFFF' : theme.colors.text }]}>
                        {locationItem.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {isContractor ? (
        <Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => setServiceCategoriesExpanded((value) => !value)}
            style={styles.accordionHeader}
          >
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Service Categories</Text>
              <Text style={[styles.email, { color: theme.colors.textMuted }]}>
                {serviceCategoriesStatus}
              </Text>
            </View>
            {serviceCategoriesExpanded ? (
              <ChevronDown color={theme.colors.textMuted} size={20} />
            ) : (
              <ChevronRight color={theme.colors.textMuted} size={20} />
            )}
          </Pressable>
          {serviceCategoriesExpanded ? (
            <View style={styles.expandedSection}>
              <Text style={[styles.email, { color: theme.colors.textMuted }]}>Match only the work types you want.</Text>
              {serviceCategoriesError ? (
                <Text style={[styles.errorText, { color: theme.colors.danger }]}>{serviceCategoriesError}</Text>
              ) : null}
              {serviceCategoriesQuery.isLoading ? (
                <Text style={[styles.email, { color: theme.colors.textMuted }]}>Loading service categories...</Text>
              ) : null}
              <View style={styles.categoryList}>
                {SERVICE_CATEGORIES.map((category) => {
                  const isExpanded = expandedServiceCategoryKeys.includes(category.key);
                  const selectedInCategory = selectedCategoryKeys.filter((key) => key.startsWith(`${category.key}:`)).length;
                  const allCategorySelected = selectedCategoryKeys.includes(`${category.key}:`);
                  return (
                    <View key={category.key} style={styles.categoryGroup}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => toggleCategoryExpanded(category.key)}
                        style={[styles.categoryHeader, { borderColor: theme.colors.border }]}
                      >
                        <View style={styles.sectionHeaderText}>
                          <Text style={[styles.preferenceTitle, { color: theme.colors.text }]}>
                            {serviceCategoryLabel(category.key)}
                          </Text>
                          <Text style={[styles.preferenceDescription, { color: theme.colors.textMuted }]}>
                            {selectedInCategory ? `${selectedInCategory} selected` : 'Tap to choose subcategories'}
                          </Text>
                        </View>
                        {isExpanded ? (
                          <ChevronDown color={theme.colors.textMuted} size={18} />
                        ) : (
                          <ChevronRight color={theme.colors.textMuted} size={18} />
                        )}
                      </Pressable>
                      {isExpanded ? (
                        <View style={styles.categoryChoices}>
                          <Pressable
                            accessibilityRole="button"
                            disabled={updateServiceCategoriesMutation.isPending}
                            onPress={() => toggleServiceCategory(category.key)}
                            style={[
                              styles.choicePill,
                              updateServiceCategoriesMutation.isPending && styles.disabledChoice,
                              {
                                alignSelf: 'flex-start',
                                backgroundColor: allCategorySelected ? theme.colors.success : theme.colors.surfaceMuted,
                                borderColor: allCategorySelected ? theme.colors.success : theme.colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.choiceText,
                                {
                                  color: allCategorySelected ? '#FFFFFF' : theme.colors.text,
                                },
                              ]}
                            >
                              All {serviceCategoryLabel(category.key)}
                            </Text>
                          </Pressable>
                          <View style={styles.choiceGrid}>
                            {category.subcategories.map((subcategory) => {
                              const selected = selectedCategoryKeys.includes(`${category.key}:${subcategory.key}`);
                              return (
                                <Pressable
                                  accessibilityRole="button"
                                  disabled={updateServiceCategoriesMutation.isPending}
                                  key={subcategory.key}
                                  onPress={() => toggleServiceCategory(category.key, subcategory.key)}
                                  style={[
                                    styles.choicePill,
                                    updateServiceCategoriesMutation.isPending && styles.disabledChoice,
                                    {
                                      backgroundColor: selected ? theme.colors.success : theme.colors.surfaceMuted,
                                      borderColor: selected ? theme.colors.success : theme.colors.border,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.choiceText, { color: selected ? '#FFFFFF' : theme.colors.text }]}>
                                    {serviceSubcategoryLabel(category.key, subcategory.key)}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {isContractor ? (
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Portfolio</Text>
            <Badge status={`${portfolioQuery.data?.length ?? 0}/10`} />
          </View>
          <View style={styles.portfolioGrid}>
            {portfolioQuery.data?.map((image) => (
              <View key={image.id} style={styles.portfolioItem}>
                <Image source={{ uri: image.url }} style={styles.portfolioImage} />
                <Button
                  title="Remove"
                  icon={Trash2}
                  variant="secondary"
                  loading={removePortfolioMutation.isPending}
                  onPress={() => removePortfolioMutation.mutate(image.id)}
                />
              </View>
            ))}
          </View>
          <Button
            title="Add Portfolio Images"
            icon={ImagePlus}
            variant="secondary"
            loading={uploadPortfolioMutation.isPending}
            onPress={pickPortfolioImages}
          />
        </Card>
      ) : null}

      {isContractor ? (
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Verification</Text>
            <Badge status={verificationQuery.data?.status ?? 'UNVERIFIED'} />
          </View>
          {verificationQuery.data?.adminNote ? (
            <Text style={[styles.email, { color: theme.colors.textMuted }]}>{verificationQuery.data.adminNote}</Text>
          ) : null}
          {verificationQuery.data?.status === 'VERIFIED' ? (
            <View style={styles.verifiedRow}>
              <ShieldCheck color={theme.colors.success} size={18} />
              <Text style={[styles.email, { color: theme.colors.textMuted }]}>Your contractor account is verified.</Text>
            </View>
          ) : null}
          {verificationQuery.data?.status === 'UNVERIFIED' || verificationQuery.data?.status === 'REJECTED' ? (
            <Button
              title="Upload Verification Document"
              icon={ShieldCheck}
              variant="secondary"
              loading={uploadVerificationMutation.isPending}
              onPress={pickVerificationDocument}
            />
          ) : null}
        </Card>
      ) : null}

      <Button title="Save Profile" icon={Save} loading={updateMutation.isPending} onPress={() => updateMutation.mutate()} />
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
        <Text style={[styles.email, { color: theme.colors.textMuted }]}>
          Delete account deactivates login access while keeping marketplace history intact.
        </Text>
        <Button
          title="Delete Account"
          icon={Trash2}
          variant="danger"
          loading={deleteAccountMutation.isPending}
          onPress={() => setDeleteAccountOpen(true)}
        />
      </Card>
      <Button title="Log Out" icon={LogOut} variant="secondary" loading={logoutMutation.isPending} onPress={() => logoutMutation.mutate()} />
    </Screen>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={styles.debugRow}>
      <Text style={[styles.debugLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text selectable style={[styles.debugValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileTopCard: {
    marginTop: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '900',
  },
  email: {
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  portfolioItem: {
    width: 112,
    gap: 6,
  },
  portfolioImage: {
    width: 112,
    height: 92,
    borderRadius: 8,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appearanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  appearanceOption: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  appearanceOptionText: {
    fontSize: 13,
    fontWeight: '900',
  },
  preferenceList: {
    gap: 14,
  },
  pushDebugBox: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  pushDebugActions: {
    flexDirection: 'row',
    gap: 8,
  },
  debugRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  debugLabel: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '900',
  },
  debugValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  expandedSection: {
    gap: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  preferenceText: {
    flex: 1,
    gap: 3,
  },
  preferenceTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  preferenceDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '900',
  },
  disabledChoice: {
    opacity: 0.55,
  },
  categoryList: {
    gap: 10,
  },
  categoryGroup: {
    gap: 8,
  },
  categoryHeader: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryChoices: {
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
});

const appearanceOptions: Array<{ label: string; value: AppearanceMode }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

function notificationPreferenceOptions(role: string | undefined): Array<{
  key: PreferenceToggleKey;
  label: string;
  description: string;
}> {
  if (role === 'ADMIN') {
    return [
      {
        key: 'adminAlerts',
        label: 'Admin alerts',
        description: 'Refunds, verification requests, and moderation items.',
      },
      {
        key: 'systemAlerts',
        label: 'System alerts',
        description: 'Account and system status changes.',
      },
    ];
  }

  const base: Array<{ key: PreferenceToggleKey; label: string; description: string }> = [
    {
      key: 'offerUpdates',
      label: 'Offer updates',
      description: 'New offers, selected offers, and contact unlock updates.',
    },
    {
      key: 'messages',
      label: 'Messages',
      description: 'Chat notifications without private message content.',
    },
    {
      key: 'reviews',
      label: 'Reviews',
      description: 'Review received, replied, or moderated alerts.',
    },
    {
      key: 'paymentsRefunds',
      label: 'Payments / refunds',
      description: 'Wallet and refund request updates.',
    },
    {
      key: 'systemAlerts',
      label: 'System alerts',
      description: 'Account and verification status changes.',
    },
  ];

  if (role === 'CONTRACTOR') {
    base.unshift({
      key: 'newJobsNearMe',
      label: 'New jobs near me',
      description: 'New jobs matching your service locations and categories.',
    });
  }

  return base;
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function logProfileSettingsFailure(label: string, error: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.warn('[profile-settings]', label, error instanceof Error ? error.message : String(error));
}

function mimeTypeFromUri(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function extensionFromMimeType(type: string) {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}

function stableAvatarReference(value: string | null | undefined) {
  if (!value || value.includes('X-Amz-Signature=')) {
    return '';
  }

  return value;
}

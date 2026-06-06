import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, LogOut, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import {
  useContractorVerification,
  usePortfolioImages,
  useRemovePortfolioImage,
  useUploadContractorVerification,
  useUploadPortfolioImages,
} from '../../api/offerWorkHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { useAuthStore } from '../../store/auth.store';
import { AuthUser, UserProfile } from '../../types/domain';

type SelectedAvatar = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  uploaded: boolean;
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ProfileEditScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const currentUser = useAuthStore((state) => state.user);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarImage, setAvatarImage] = useState<SelectedAvatar | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [tradeCategories, setTradeCategories] = useState('');

  const query = useQuery({
    queryKey: ['users', 'me'],
    queryFn: api.profile,
  });
  const portfolioQuery = usePortfolioImages(currentUser?.role === 'CONTRACTOR');
  const verificationQuery = useContractorVerification(currentUser?.role === 'CONTRACTOR');
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
    setAvatarUrl(profile.avatarUrl ?? '');
    setAvatarImage(null);
    setCompanyName(profile.companyName ?? '');
    setTradeCategories(profile.tradeCategories?.join(', ') ?? '');
  }, [query.data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let nextAvatarUrl = avatarUrl;

      if (avatarImage && !avatarImage.uploaded) {
        const uploadedProfile = await api.uploadAvatar(avatarImage);
        nextAvatarUrl = uploadedProfile.avatarUrl ?? '';
      }

      return api.updateProfile({
        displayName,
        phone,
        location,
        bio,
        avatarUrl: nextAvatarUrl,
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
      setAvatarUrl(profile.avatarUrl ?? '');
      setAvatarImage(null);
      await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      Alert.alert('Profile saved', 'Your profile has been updated.');
    },
    onError: (error) => {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Please check the form.');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSettled: async () => {
      await clearSession();
      queryClient.clear();
    },
  });

  const role = query.data?.role ?? currentUser?.role;
  const canUploadAvatar = role === 'EMPLOYER' || role === 'CONTRACTOR';
  const avatarPreviewUri = avatarImage?.uri ?? avatarUrl;
  const isContractor = role === 'CONTRACTOR';

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
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
    <Screen>
      <Card>
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            {avatarPreviewUri ? (
              <Image source={{ uri: avatarPreviewUri }} style={styles.avatarImage} />
            ) : (
              <UserRound color="#FFFFFF" size={28} />
            )}
          </View>
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
      <Button title="Log Out" icon={LogOut} variant="secondary" loading={logoutMutation.isPending} onPress={() => logoutMutation.mutate()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
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
});

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

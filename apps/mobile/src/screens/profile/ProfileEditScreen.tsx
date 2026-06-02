import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, LogOut, Save, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
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

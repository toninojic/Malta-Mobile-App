import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Save, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { useAuthStore } from '../../store/auth.store';
import { AuthUser, UserProfile } from '../../types/domain';

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
    setCompanyName(profile.companyName ?? '');
    setTradeCategories(profile.tradeCategories?.join(', ') ?? '');
  }, [query.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateProfile({
        displayName,
        phone,
        location,
        bio,
        avatarUrl,
        companyName,
        tradeCategories: tradeCategories
          .split(',')
          .map((category) => category.trim())
          .filter(Boolean),
      }),
    onSuccess: async (profile) => {
      const nextUser = {
        ...(currentUser as AuthUser),
        profile: profile as UserProfile,
      };
      await updateUser(nextUser);
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

  return (
    <Screen>
      <Card>
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <UserRound color="#FFFFFF" size={28} />
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
      <TextField label="Avatar URL" value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" />
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
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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

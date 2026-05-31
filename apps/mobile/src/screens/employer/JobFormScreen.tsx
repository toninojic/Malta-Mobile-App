import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Save } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { OptionSelect } from '../../components/OptionSelect';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { SERVICE_CATEGORIES } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { JobFormValues } from '../../types/domain';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobForm'>;

export function JobFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const jobId = route.params?.jobId;
  const isEditing = Boolean(jobId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [location, setLocation] = useState('');
  const [imageText, setImageText] = useState('');
  const selectedCategory = SERVICE_CATEGORIES.find((item) => item.key === category);

  const query = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => api.job(jobId as string),
    enabled: isEditing,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    setTitle(query.data.title);
    setDescription(query.data.description);
    setCategory(query.data.category);
    setSubcategory(query.data.subcategory);
    setLocation(query.data.location);
    setImageText(query.data.images.map((image) => image.url).join('\n'));
  }, [query.data]);

  const values = useMemo<JobFormValues>(
    () => ({
      title,
      description,
      category,
      subcategory,
      location,
      imageUrls: imageText
        .split(/\n|,/)
        .map((url) => url.trim())
        .filter(Boolean),
    }),
    [category, description, imageText, location, subcategory, title],
  );

  const mutation = useMutation({
    mutationFn: () => (jobId ? api.updateJob(jobId, values) : api.createJob(values)),
    onSuccess: async (job) => {
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigation.replace('JobDetails', { jobId: job.id });
    },
    onError: (error) => {
      Alert.alert('Could not save job', error instanceof Error ? error.message : 'Please check the form.');
    },
  });

  const submit = () => {
    if (title.trim().length < 4 || description.trim().length < 20) {
      Alert.alert('More detail needed', 'Add a clear title and description before saving.');
      return;
    }
    if (!category || !subcategory) {
      Alert.alert('Category needed', 'Choose a category and subcategory before saving.');
      return;
    }

    mutation.mutate();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{isEditing ? 'Edit job request' : 'Create job request'}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Requests stay active for 30 days.</Text>
      </View>
      <TextField label="Title" value={title} onChangeText={setTitle} />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      <OptionSelect
        label="Category"
        value={category}
        options={SERVICE_CATEGORIES}
        onChange={(value) => {
          setCategory(value);
          setSubcategory('');
        }}
      />
      <OptionSelect
        label="Subcategory"
        value={subcategory}
        options={selectedCategory?.subcategories ?? []}
        placeholder="Choose a category first."
        onChange={setSubcategory}
      />
      <TextField label="Location" value={location} onChangeText={setLocation} />
      <TextField label="Image URLs" value={imageText} onChangeText={setImageText} multiline autoCapitalize="none" />
      <Button title={isEditing ? 'Save Changes' : 'Create Job'} icon={Save} loading={mutation.isPending} onPress={submit} />
    </Screen>
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
  },
});

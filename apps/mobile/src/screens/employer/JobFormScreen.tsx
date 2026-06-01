import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Save, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
type SelectedImage = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  uploaded: boolean;
};

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
  const [images, setImages] = useState<SelectedImage[]>([]);
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
    setImages(
      query.data.images.map((image) => ({
        uri: image.url,
        name: image.url.split('/').pop() ?? image.id,
        type: mimeTypeFromUri(image.url),
        uploaded: true,
      })),
    );
  }, [query.data]);

  const values = useMemo<JobFormValues>(
    () => ({
      title,
      description,
      category,
      subcategory,
      location,
      imageUrls: images.filter((image) => image.uploaded).map((image) => image.uri),
    }),
    [category, description, images, location, subcategory, title],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const uploadedImages = images.filter((image) => image.uploaded);
      const localImages = images.filter((image) => !image.uploaded);
      const uploadedUrls = localImages.length ? (await api.uploadJobImages(localImages)).images.map((image) => image.url) : [];
      const payload = {
        ...values,
        imageUrls: [...uploadedImages.map((image) => image.uri), ...uploadedUrls],
      };

      return jobId ? api.updateJob(jobId, payload) : api.createJob(payload);
    },
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

  const pickImages = async () => {
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      Alert.alert('Image limit reached', 'You can add up to 5 images.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose job images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.82,
    });

    if (result.canceled) {
      return;
    }

    const nextImages: SelectedImage[] = [];
    for (const asset of result.assets.slice(0, remainingSlots)) {
      const type = asset.mimeType ?? mimeTypeFromUri(asset.uri);
      if (!ALLOWED_IMAGE_TYPES.includes(type)) {
        Alert.alert('Unsupported image', 'Only jpg, jpeg, png, and webp images are allowed.');
        continue;
      }

      if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) {
        Alert.alert('Image too large', 'Each image must be 5MB or smaller.');
        continue;
      }

      nextImages.push({
        uri: asset.uri,
        name: asset.fileName ?? `job-image-${Date.now()}.${extensionFromMimeType(type)}`,
        type,
        size: asset.fileSize,
        uploaded: false,
      });
    }

    setImages((current) => [...current, ...nextImages].slice(0, MAX_IMAGES));
  };

  const removeImage = (uri: string) => {
    setImages((current) => current.filter((image) => image.uri !== uri));
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
      <View style={styles.imageHeader}>
        <Text style={[styles.imageLabel, { color: theme.colors.text }]}>Images</Text>
        <Button title="Add" icon={ImagePlus} variant="secondary" onPress={pickImages} style={styles.addImageButton} />
      </View>
      {images.length ? (
        <View style={styles.imageGrid}>
          {images.map((image) => (
            <View key={image.uri} style={styles.previewWrap}>
              <Image source={{ uri: image.uri }} style={styles.preview} />
              <Pressable accessibilityRole="button" onPress={() => removeImage(image.uri)} style={styles.removeImage}>
                <X color="#FFFFFF" size={16} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Button title={isEditing ? 'Save Changes' : 'Create Job'} icon={Save} loading={mutation.isPending} onPress={submit} />
    </Screen>
  );
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
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  addImageButton: {
    width: 92,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewWrap: {
    width: 96,
    height: 96,
  },
  preview: {
    width: 96,
    height: 96,
    borderRadius: 8,
  },
  removeImage: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
});

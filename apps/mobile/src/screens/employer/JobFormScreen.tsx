import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Save, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../api/client';
import { cacheJob, invalidateMarketplaceState } from '../../api/invalidation';
import { Button } from '../../components/Button';
import { CategoryAccordion } from '../../components/CategoryAccordion';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
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
type JobField = 'title' | 'description' | 'category' | 'subcategory' | 'location';
type JobFieldErrors = Partial<Record<JobField, string>>;

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
  const [fieldErrors, setFieldErrors] = useState<JobFieldErrors>({});
  const [formError, setFormError] = useState('');

  const query = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => api.job(jobId as string),
    enabled: isEditing,
    refetchOnWindowFocus: true,
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
      cacheJob(queryClient, job);
      await invalidateMarketplaceState(queryClient, { jobId: job.id });
      navigation.replace('JobDetails', { jobId: job.id });
    },
    onError: (error) => {
      const backendErrors = mapBackendErrors(error);
      setFieldErrors((current) => ({ ...current, ...backendErrors }));
      setFormError(error instanceof Error ? error.message : 'Please check the form.');
    },
  });

  const submit = () => {
    const nextErrors = validateJobForm({ title, description, category, subcategory, location });
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setFormError('Please fix the highlighted fields.');
      return;
    }

    setFormError('');
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
      {formError ? <Text style={[styles.formError, { color: theme.colors.danger }]}>{formError}</Text> : null}
      <TextField
        label="Title"
        value={title}
        error={fieldErrors.title}
        onChangeText={(value) => {
          setTitle(value);
          setFieldErrors((current) => ({ ...current, title: undefined }));
        }}
      />
      <TextField
        label="Description"
        value={description}
        error={fieldErrors.description}
        onChangeText={(value) => {
          setDescription(value);
          setFieldErrors((current) => ({ ...current, description: undefined }));
        }}
        multiline
      />
      <CategoryAccordion
        label="Category"
        category={category}
        subcategory={subcategory}
        error={fieldErrors.category ?? fieldErrors.subcategory}
        onSelect={(nextCategory, nextSubcategory) => {
          setCategory(nextCategory);
          setSubcategory(nextSubcategory);
          setFieldErrors((current) => ({ ...current, category: undefined, subcategory: undefined }));
        }}
      />
      <TextField
        label="Location"
        value={location}
        error={fieldErrors.location}
        onChangeText={(value) => {
          setLocation(value);
          setFieldErrors((current) => ({ ...current, location: undefined }));
        }}
      />
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
  formError: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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

function validateJobForm(input: {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  location: string;
}) {
  const errors: JobFieldErrors = {};

  if (!input.title.trim()) {
    errors.title = 'Title is required.';
  } else if (input.title.trim().length < 5) {
    errors.title = 'Title must be at least 5 characters.';
  }

  if (!input.description.trim()) {
    errors.description = 'Description is required.';
  } else if (input.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters.';
  }

  if (!input.category) {
    errors.category = 'Category is required.';
  }

  if (!input.subcategory) {
    errors.subcategory = 'Subcategory is required.';
  }

  if (!input.location.trim()) {
    errors.location = 'Location is required.';
  }

  return errors;
}

function mapBackendErrors(error: unknown) {
  if (!(error instanceof ApiError)) {
    return {};
  }

  const details = error.details as { message?: unknown } | undefined;
  const messages = Array.isArray(details?.message)
    ? details.message.map(String)
    : typeof details?.message === 'string'
      ? [details.message]
      : [error.message];
  const errors: JobFieldErrors = {};

  messages.forEach((message) => {
    if (message.startsWith('Title')) {
      errors.title = message;
    } else if (message.startsWith('Description')) {
      errors.description = message;
    } else if (message.startsWith('Category') || message === 'Invalid service category.') {
      errors.category = message;
    } else if (message.startsWith('Subcategory') || message === 'Invalid service subcategory for selected category.') {
      errors.subcategory = message;
    } else if (message.startsWith('Location')) {
      errors.location = message;
    }
  });

  return errors;
}

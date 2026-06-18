import * as ImagePicker from 'expo-image-picker';
import { BriefcaseBusiness, CheckCircle2, ChevronDown, ChevronRight, ImagePlus, MapPin, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useContractorServiceAreas,
  useContractorServiceCategories,
  useContractorVerification,
  usePortfolioImages,
  useUpdateContractorServiceAreas,
  useUpdateContractorServiceCategories,
  useUploadContractorVerification,
  useUploadPortfolioImages,
} from '../../api/offerWorkHooks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { MALTA_SERVICE_LOCATIONS } from '../../config/maltaLocations';
import { SERVICE_CATEGORIES, serviceCategoryLabel, serviceSubcategoryLabel } from '../../config/serviceCategories';
import { useTheme } from '../../design/theme';

type ContractorSetupScreenProps = {
  onComplete: () => void;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ContractorSetupScreen({ onComplete }: ContractorSetupScreenProps) {
  const theme = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [locationSearch, setLocationSearch] = useState('');
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<string[]>([]);
  const serviceAreasQuery = useContractorServiceAreas(true);
  const serviceCategoriesQuery = useContractorServiceCategories(true);
  const portfolioQuery = usePortfolioImages(true);
  const verificationQuery = useContractorVerification(true);
  const updateServiceAreasMutation = useUpdateContractorServiceAreas();
  const updateServiceCategoriesMutation = useUpdateContractorServiceCategories();
  const uploadPortfolioMutation = useUploadPortfolioImages();
  const uploadVerificationMutation = useUploadContractorVerification();
  const selectedLocationKeys = serviceAreasQuery.data?.locations.map((location) => location.locationKey) ?? [];
  const selectedCategoryKeys =
    serviceCategoriesQuery.data?.categories.map((category) => `${category.categoryKey}:${category.subcategoryKey ?? ''}`) ?? [];
  const step = steps[stepIndex] ?? steps[0];
  const StepIcon = step.icon;
  const isLastStep = stepIndex === steps.length - 1;

  const goNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const toggleLocation = (locationKey: string) => {
    if (updateServiceAreasMutation.isPending) {
      return;
    }

    const next = new Set(selectedLocationKeys);
    if (next.has(locationKey)) {
      next.delete(locationKey);
    } else {
      next.add(locationKey);
    }

    updateServiceAreasMutation.mutate([...next]);
  };

  const toggleCategory = (categoryKey: string, subcategoryKey?: string | null) => {
    if (updateServiceCategoriesMutation.isPending) {
      return;
    }

    const id = `${categoryKey}:${subcategoryKey ?? ''}`;
    const next = new Set(selectedCategoryKeys);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    updateServiceCategoriesMutation.mutate(
      [...next].flatMap((value) => {
        const [nextCategoryKey, nextSubcategoryKey] = value.split(':');
        return nextCategoryKey ? [{ categoryKey: nextCategoryKey, subcategoryKey: nextSubcategoryKey || null }] : [];
      }),
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
      Alert.alert('Permission needed', 'Allow photo library access to add portfolio images.');
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
      };
    });

    const invalid = images.find((image) => !ALLOWED_IMAGE_TYPES.includes(image.type) || (image.size && image.size > MAX_IMAGE_SIZE));
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
      Alert.alert('Permission needed', 'Allow photo library access to choose a verification document.');
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
    if (!ALLOWED_IMAGE_TYPES.includes(type)) {
      Alert.alert('Unsupported document', 'Use jpg, jpeg, png, or webp from the app.');
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_DOCUMENT_SIZE) {
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

  const availableLocations = serviceAreasQuery.data?.availableLocations ?? MALTA_SERVICE_LOCATIONS;
  const filteredLocations = availableLocations.filter((location) => {
    const query = locationSearch.trim().toLowerCase();
    return !query || location.label.toLowerCase().includes(query) || location.key.includes(query);
  });

  return (
    <Screen safeAreaTop>
      <Card>
        <View style={styles.stepHeader}>
          <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.success}18` }]}>
            <StepIcon color={theme.colors.success} size={24} />
          </View>
          <View style={styles.stepCopy}>
            <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
              Step {stepIndex + 1} of {steps.length}
            </Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>{step.title}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{step.description}</Text>
          </View>
        </View>
      </Card>

      {step.key === 'locations' ? (
        <Card>
          <TextField label="Search locations" value={locationSearch} onChangeText={setLocationSearch} />
          <View style={styles.choiceGrid}>
            {filteredLocations.map((location) => {
              const selected = selectedLocationKeys.includes(location.key);
              return (
                <ChoicePill
                  key={location.key}
                  label={location.label}
                  selected={selected}
                  disabled={updateServiceAreasMutation.isPending}
                  onPress={() => toggleLocation(location.key)}
                />
              );
            })}
          </View>
        </Card>
      ) : null}

      {step.key === 'categories' ? (
        <Card>
          <View style={styles.categoryList}>
            {SERVICE_CATEGORIES.map((category) => {
              const expanded = expandedCategoryKeys.includes(category.key);
              const selectedInCategory = selectedCategoryKeys.filter((key) => key.startsWith(`${category.key}:`)).length;
              const allCategorySelected = selectedCategoryKeys.includes(`${category.key}:`);
              return (
                <View key={category.key} style={styles.categoryGroup}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setExpandedCategoryKeys((current) =>
                        current.includes(category.key)
                          ? current.filter((key) => key !== category.key)
                          : [...current, category.key],
                      )
                    }
                    style={[styles.categoryHeader, { borderColor: theme.colors.border }]}
                  >
                    <View style={styles.categoryCopy}>
                      <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>{serviceCategoryLabel(category.key)}</Text>
                      <Text style={[styles.categoryMeta, { color: theme.colors.textMuted }]}>
                        {selectedInCategory ? `${selectedInCategory} selected` : 'Choose subcategories'}
                      </Text>
                    </View>
                    {expanded ? <ChevronDown color={theme.colors.textMuted} size={18} /> : <ChevronRight color={theme.colors.textMuted} size={18} />}
                  </Pressable>
                  {expanded ? (
                    <View style={styles.categoryChoices}>
                      <ChoicePill
                        label={`All ${serviceCategoryLabel(category.key)}`}
                        selected={allCategorySelected}
                        disabled={updateServiceCategoriesMutation.isPending}
                        onPress={() => toggleCategory(category.key)}
                      />
                      {category.subcategories.map((subcategory) => (
                        <ChoicePill
                          key={subcategory.key}
                          label={serviceSubcategoryLabel(category.key, subcategory.key)}
                          selected={selectedCategoryKeys.includes(`${category.key}:${subcategory.key}`)}
                          disabled={updateServiceCategoriesMutation.isPending}
                          onPress={() => toggleCategory(category.key, subcategory.key)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {step.key === 'portfolio' ? (
        <Card>
          <View style={styles.inlineHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Portfolio images</Text>
            <Badge status={`${portfolioQuery.data?.length ?? 0}/10`} />
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Add photos of previous work when you are ready.</Text>
          <Button title="Add Portfolio Images" icon={ImagePlus} variant="secondary" loading={uploadPortfolioMutation.isPending} onPress={pickPortfolioImages} />
        </Card>
      ) : null}

      {step.key === 'verification' ? (
        <Card>
          <View style={styles.inlineHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Verification status</Text>
            <Badge status={verificationQuery.data?.status ?? 'UNVERIFIED'} />
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Upload a document now or come back later from Profile.</Text>
          <Button
            title="Upload Verification Document"
            icon={ShieldCheck}
            variant="secondary"
            loading={uploadVerificationMutation.isPending}
            onPress={pickVerificationDocument}
          />
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button title="Skip for now" variant="secondary" onPress={goNext} />
        <Button title={isLastStep ? 'Finish Setup' : 'Next'} icon={isLastStep ? CheckCircle2 : undefined} onPress={goNext} />
      </View>
    </Screen>
  );
}

function ChoicePill({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choicePill,
        {
          backgroundColor: selected ? theme.colors.success : theme.colors.surfaceMuted,
          borderColor: selected ? theme.colors.success : theme.colors.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Text style={[styles.choiceText, { color: selected ? '#FFFFFF' : theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const steps = [
  {
    key: 'locations',
    title: 'Service Locations',
    description: 'Choose where you work so MaltaPro can send relevant nearby job alerts.',
    icon: MapPin,
  },
  {
    key: 'categories',
    title: 'Service Categories',
    description: 'Choose the types of jobs you want matched with your contractor profile.',
    icon: BriefcaseBusiness,
  },
  {
    key: 'portfolio',
    title: 'Portfolio Images',
    description: 'Photos of previous work help employers understand your quality before they unlock contact.',
    icon: ImagePlus,
  },
  {
    key: 'verification',
    title: 'Verification',
    description: 'Verification helps build trust and may improve employer confidence.',
    icon: ShieldCheck,
  },
] as const;

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
  stepHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  stepCopy: {
    flex: 1,
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
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
  categoryCopy: {
    flex: 1,
    gap: 3,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  categoryMeta: {
    fontSize: 12,
  },
  categoryChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});

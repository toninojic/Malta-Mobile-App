import { ChevronDown, ChevronRight, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SERVICE_CATEGORIES, serviceCategoryLabel, serviceSubcategoryLabel } from '../config/serviceCategories';
import { useTheme } from '../design/theme';

type Props = {
  label: string;
  category?: string;
  subcategory?: string;
  onSelect: (category: string, subcategory: string) => void;
  error?: string;
};

export function CategoryAccordion({ label, category, subcategory, onSelect, error }: Props) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(category || SERVICE_CATEGORIES[0]?.key || '');

  useEffect(() => {
    if (category) {
      setExpanded(category);
    }
  }, [category]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      {category && subcategory ? (
        <Text style={[styles.selected, { color: theme.colors.textMuted }]}>
          {serviceCategoryLabel(category)} / {serviceSubcategoryLabel(category, subcategory)}
        </Text>
      ) : null}
      <View style={[styles.panel, { borderColor: error ? theme.colors.danger : theme.colors.border }]}>
        {SERVICE_CATEGORIES.map((item) => {
          const isExpanded = expanded === item.key;
          const isCategorySelected = category === item.key;

          return (
            <View key={item.key} style={[styles.categoryBlock, { borderColor: theme.colors.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Toggle ${item.label}`}
                onPress={() => setExpanded(isExpanded ? '' : item.key)}
                style={({ pressed }) => [
                  styles.categoryButton,
                  {
                    backgroundColor: isCategorySelected ? `${theme.colors.primary}12` : theme.colors.surface,
                    opacity: pressed ? 0.76 : 1,
                  },
                ]}
              >
                {isExpanded ? <ChevronDown color={theme.colors.textMuted} size={18} /> : <ChevronRight color={theme.colors.textMuted} size={18} />}
                <Text style={[styles.categoryText, { color: isCategorySelected ? theme.colors.primary : theme.colors.text }]}>
                  {item.label}
                </Text>
              </Pressable>
              {isExpanded ? (
                <View style={styles.subcategories}>
                  {item.subcategories.map((child) => {
                    const selected = category === item.key && subcategory === child.key;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${item.label} ${child.label}`}
                        key={child.key}
                        onPress={() => onSelect(item.key, child.key)}
                        style={({ pressed }) => [
                          styles.subcategoryButton,
                          {
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: selected ? `${theme.colors.primary}18` : theme.colors.surfaceMuted,
                            opacity: pressed ? 0.76 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.subcategoryText, { color: selected ? theme.colors.primary : theme.colors.text }]}>
                          {child.label}
                        </Text>
                        {selected ? <Check color={theme.colors.primary} size={16} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  selected: {
    fontSize: 13,
    lineHeight: 18,
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  categoryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  subcategories: {
    gap: 8,
    padding: 12,
    paddingTop: 0,
  },
  subcategoryButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  subcategoryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    fontSize: 12,
  },
});

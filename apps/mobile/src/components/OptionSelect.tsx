import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../design/theme';

type Option = {
  key: string;
  label: string;
};

type OptionSelectProps = {
  label: string;
  value?: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export function OptionSelect({ label, value, options, onChange, placeholder }: OptionSelectProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      {options.length ? (
        <View style={styles.options}>
          {options.map((option) => {
            const selected = option.key === value;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.key}
                onPress={() => onChange(option.key)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? `${theme.colors.primary}18` : theme.colors.surface,
                    opacity: pressed ? 0.76 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: selected ? theme.colors.primary : theme.colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.empty, { color: theme.colors.textMuted }]}>{placeholder ?? 'Choose an option first.'}</Text>
      )}
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  empty: {
    fontSize: 13,
  },
});

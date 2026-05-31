import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../design/theme';

type RatingInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function RatingInput({ value, onChange, disabled }: RatingInputProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <Pressable
          accessibilityRole="button"
          key={rating}
          disabled={disabled}
          onPress={() => onChange(rating)}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.72 : 1 }]}
        >
          <Star
            color={theme.colors.warning}
            fill={rating <= value ? theme.colors.warning : 'transparent'}
            size={32}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 4,
  },
});

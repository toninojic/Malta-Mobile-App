import { ComponentType, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../design/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ComponentType<{ color?: string; size?: number }>;
  style?: ViewStyle;
  children?: ReactNode;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon: Icon,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const colors = {
    primary: {
      background: theme.colors.primary,
      text: '#FFFFFF',
      border: theme.colors.primary,
    },
    secondary: {
      background: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
    },
    ghost: {
      background: 'transparent',
      text: theme.colors.text,
      border: 'transparent',
    },
    danger: {
      background: theme.colors.danger,
      text: '#FFFFFF',
      border: theme.colors.danger,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && variant === 'primary' ? theme.colors.primaryPressed : colors.background,
          borderColor: colors.border,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon color={colors.text} size={18} /> : null}
          <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
});

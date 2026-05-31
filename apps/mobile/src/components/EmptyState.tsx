import { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../design/theme';
import { Button } from './Button';

type EmptyStateProps = {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
  icon?: ComponentType<{ color?: string; size?: number }>;
};

export function EmptyState({ title, message, actionTitle, onAction, icon: Icon }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      {Icon ? <Icon color={theme.colors.primary} size={36} /> : null}
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

import { ComponentType, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../design/theme';

export type AppModalAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

type AppModalProps = {
  visible: boolean;
  title: string;
  body: string;
  icon?: ComponentType<{ color?: string; size?: number }>;
  media?: ReactNode;
  actions: AppModalAction[];
  onRequestClose: () => void;
};

export function AppModal({ visible, title, body, icon: Icon, media, actions, onRequestClose }: AppModalProps) {
  const theme = useTheme();

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {Icon ? (
            <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.success}18` }]}>
              <Icon color={theme.colors.success} size={24} />
            </View>
          ) : null}
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {media}
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{body}</Text>
          <View style={styles.actions}>
            {actions.map((action) => (
              <ModalButton key={action.label} action={action} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModalButton({ action }: { action: AppModalAction }) {
  const theme = useTheme();
  const variant = action.variant ?? 'secondary';
  const background =
    variant === 'primary'
      ? theme.colors.success
      : variant === 'danger'
        ? theme.colors.danger
        : theme.colors.surfaceMuted;
  const border =
    variant === 'primary'
      ? theme.colors.success
      : variant === 'danger'
        ? theme.colors.danger
        : theme.colors.border;
  const text = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={action.disabled}
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: action.disabled ? 0.5 : pressed ? 0.84 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: text }]}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 96,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '900',
  },
});

import { Text, StyleSheet } from 'react-native';
import { JobStatus } from '../types/domain';
import { useTheme } from '../design/theme';

type BadgeProps = {
  status: JobStatus | string;
};

export function Badge({ status }: BadgeProps) {
  const theme = useTheme();
  const tone =
    status === 'ACTIVE'
      ? theme.colors.primary
      : status === 'REJECTED' || status === 'JOB CLOSED'
        ? theme.colors.danger
        : status === 'CLOSED'
          ? theme.colors.textMuted
          : theme.colors.warning;

  return (
    <Text
      style={[
        styles.badge,
        {
          color: tone,
          borderColor: tone,
          backgroundColor: `${tone}18`,
        },
      ]}
    >
      {status}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

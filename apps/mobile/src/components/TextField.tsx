import { ComponentType } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../design/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  icon?: ComponentType<{ color?: string; size?: number }>;
};

export function TextField({ label, error, icon: Icon, style, ...props }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        {Icon ? <Icon color={theme.colors.textMuted} size={18} /> : null}
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              minHeight: props.multiline ? 112 : 48,
              textAlignVertical: props.multiline ? 'top' : 'center',
            },
            style,
          ]}
          {...props}
        />
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
  inputWrap: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  error: {
    fontSize: 12,
  },
});

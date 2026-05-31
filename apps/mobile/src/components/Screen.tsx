import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({ children, scroll = true, footer, refreshing = false, onRefresh }: ScreenProps) {
  const theme = useTheme();
  const content = (
    <View style={[styles.content, { padding: theme.spacing.lg }]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer ? <View style={[styles.footer, { borderColor: theme.colors.border }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    gap: 16,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
});

import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardAware?: boolean;
  safeAreaTop?: boolean;
  safeAreaBottom?: boolean;
  contentTopPadding?: number;
  contentBottomPadding?: number;
};

export function Screen({
  children,
  scroll = true,
  footer,
  refreshing = false,
  onRefresh,
  keyboardAware = true,
  safeAreaTop = false,
  safeAreaBottom = false,
  contentTopPadding,
  contentBottomPadding,
}: ScreenProps) {
  const theme = useTheme();
  const safeAreaEdges: Edge[] = ['left', 'right'];
  if (safeAreaTop) {
    safeAreaEdges.unshift('top');
  }
  if (safeAreaBottom) {
    safeAreaEdges.push('bottom');
  }
  const content = (
    <View
      style={[
        styles.content,
        {
          padding: theme.spacing.lg,
          paddingTop: contentTopPadding ?? theme.spacing.lg,
          paddingBottom: contentBottomPadding ?? theme.spacing.lg,
        },
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={safeAreaEdges} style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        enabled={keyboardAware}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.root}
      >
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
      </KeyboardAvoidingView>
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

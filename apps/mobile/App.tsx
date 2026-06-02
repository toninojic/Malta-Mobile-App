import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { AppState, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from './src/api/client';
import { apiConfig, logApiStartupDiagnostics } from './src/config/apiConfig';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  const colorScheme = useColorScheme();
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 5 * 60_000,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status === 429) {
                return false;
              }

              return failureCount < 2;
            },
            staleTime: 30_000,
          },
          mutations: {
            retry: false,
          },
        },
      }),
    [],
  );
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    logApiStartupDiagnostics();
  }, []);

  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {apiConfig.deviceTestingError ? <ApiConfigErrorScreen /> : <RootNavigator />}
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function ApiConfigErrorScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#F7F4EF' }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#1E293B' }}>API configuration needed</Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: '#475569' }}>{apiConfig.deviceTestingError}</Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: '#64748B' }}>Resolved API URL: {apiConfig.baseUrl || '[missing]'}</Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: '#64748B' }}>Health URL: {apiConfig.healthUrl || '[missing]'}</Text>
    </View>
  );
}

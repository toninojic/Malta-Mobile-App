import { useColorScheme } from 'react-native';
import { darkColors, lightColors } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
};

export const typography = {
  title: 30,
  h1: 24,
  h2: 20,
  body: 16,
  small: 14,
  caption: 12,
};

export function useTheme() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;

  return {
    colors,
    spacing,
    radii,
    typography,
    isDark: colorScheme === 'dark',
  };
}

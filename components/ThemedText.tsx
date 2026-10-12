import { Text, TextProps, StyleSheet } from 'react-native';
import { typography } from '@/lib/theme';

interface Props extends TextProps {
  variant?: keyof typeof typography;
}

export function ThemedText({ variant = 'body', style, ...props }: Props) {
  return <Text {...props} style={StyleSheet.flatten([typography[variant], style])} />;
}

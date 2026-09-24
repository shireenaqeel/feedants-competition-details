import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, fonts } from '@/theme';

export interface TextProps extends RNTextProps {
  size?: number;
  weight?: keyof typeof fonts;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

// Custom fonts ignore fontWeight on Android, so weight selects the font family instead.
export function Text({ size = 14, weight = 'regular', color = colors.text, align, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[{ fontFamily: fonts[weight], fontSize: size, color, textAlign: align, lineHeight: Math.round(size * 1.45) }, style]}
    />
  );
}

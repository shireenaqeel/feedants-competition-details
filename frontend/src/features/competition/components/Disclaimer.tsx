import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

export function Disclaimer({ text }: { text: string }) {
  const { t } = useLanguage();
  return (
    <View style={styles.bar}>
      <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
      <Text size={12} style={{ flex: 1 }}>
        <Text size={12} weight="semibold" color={colors.primary}>
          {t('disclaimer')}{' '}
        </Text>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
});

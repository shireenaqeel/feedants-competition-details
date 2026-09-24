import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

/** Placeholder slot for a future ad integration. */
export function AdSlot() {
  const { t } = useLanguage();
  return (
    <View style={styles.slot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <MaterialCommunityIcons name="bullhorn-outline" size={18} color={colors.textMuted} />
      <Text size={13} weight="medium" color={colors.textMuted}>
        {t('adHere')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textSubtle, borderRadius: radius.md, paddingVertical: 12 },
});

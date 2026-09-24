import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { Lang } from '@/i18n/strings';
import { colors, radius } from '@/theme';

export function ScreenHeader({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
        <Text size={16} weight="medium">
          {t('goBack')}
        </Text>
      </Pressable>
      <LanguageToggle />
    </View>
  );
}

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'ENG' },
  { value: 'hi', label: 'हिंदी' },
];

export function LanguageToggle() {
  const { lang } = useLanguage();
  const { changeLanguage: setLang } = useAuth();
  return (
    <View style={styles.toggle} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const active = o.value === lang;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => setLang(o.value)}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text size={13} weight="semibold" color={active ? '#fff' : colors.textMuted}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { flexDirection: 'row', backgroundColor: colors.chip, borderRadius: radius.pill, padding: 3, borderWidth: 1, borderColor: colors.border },
  option: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.pill },
  optionActive: { backgroundColor: colors.primary },
});

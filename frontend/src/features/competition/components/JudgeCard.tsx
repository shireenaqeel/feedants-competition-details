import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Judge } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors } from '@/theme';

export function JudgeCard({ judge, onPlayIntro }: { judge: Judge; onPlayIntro: (url: string) => void }) {
  const { t } = useLanguage();
  return (
    <Card style={styles.row}>
      <Image source={judge.avatarUrl ?? undefined} style={styles.avatar} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      <View style={{ flex: 1 }}>
        <Text size={12} color={colors.textMuted}>
          {t('judge')}
        </Text>
        <Text size={16} weight="semibold">
          {judge.name}
        </Text>
        <Text size={12} color={colors.textMuted}>
          {judge.title}
        </Text>
        {judge.experienceYears !== null && (
          <Text size={12} color={colors.textMuted}>
            {t('yearsExperience', { n: judge.experienceYears })}
          </Text>
        )}
      </View>
      {judge.introVideoUrl && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('introVideo')}: ${judge.name}`}
          onPress={() => onPlayIntro(judge.introVideoUrl!)}
          style={styles.intro}
        >
          <View style={styles.play}>
            <Ionicons name="play" size={20} color={colors.primary} style={{ marginLeft: 2 }} />
          </View>
          <Text size={12} color={colors.textMuted}>
            {t('introVideo')}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.chip },
  intro: { alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});

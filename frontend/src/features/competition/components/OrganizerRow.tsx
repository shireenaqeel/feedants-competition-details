import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CompetitionDetails } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { RatingBadge } from '@/components/ui/Stars';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors } from '@/theme';

export function OrganizerRow({ organizer }: { organizer: NonNullable<CompetitionDetails['competition']['organizer']> }) {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/users/[id]', params: { id: organizer.id } })}>
      <Card style={styles.row}>
        {organizer.avatarUrl ? <Image source={organizer.avatarUrl} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.chip }]} />}
        <View style={{ flex: 1 }}>
          <Text size={11} color={colors.textMuted}>
            {t('organizedBy')}
          </Text>
          <Text size={14} weight="semibold">
            {organizer.name}
          </Text>
        </View>
        <RatingBadge rating={organizer.rating} />
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
});

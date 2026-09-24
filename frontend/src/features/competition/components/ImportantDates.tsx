import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Timeline } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDate, formatTime } from '@/lib/format';
import { colors, radius } from '@/theme';

export function ImportantDates({ timeline }: { timeline: Timeline }) {
  const { t, lang } = useLanguage();
  const icon = (node: ReactNode) => <View style={styles.icon}>{node}</View>;
  const cells = [
    { label: t('registerBefore'), at: timeline.registrationClosesAt, icon: icon(<Ionicons name="calendar-outline" size={24} color={colors.primary} />) },
    { label: t('submissionStarts'), at: timeline.submissionStartsAt, icon: icon(<Feather name="send" size={22} color={colors.primary} />) },
    { label: t('submissionEnds'), at: timeline.submissionEndsAt, icon: icon(<Feather name="upload" size={22} color={colors.primary} />) },
    { label: t('resultDate'), at: timeline.resultAt, icon: icon(<MaterialCommunityIcons name="trophy-outline" size={24} color={colors.primary} />) },
  ];

  return (
    <Card>
      <Text size={15} weight="semibold" style={{ marginBottom: 10 }}>
        {t('importantDates')}
      </Text>
      <View style={styles.grid}>
        {cells.map((cell, i) => (
          <View key={cell.label} style={[styles.cell, i % 2 === 0 && styles.cellLeft, i < 2 && styles.cellTop]}>
            {cell.icon}
            <View style={{ flexShrink: 1 }}>
              <Text size={11} color={colors.textMuted}>
                {cell.label}
              </Text>
              <Text size={14} weight="semibold" color={colors.primary}>
                {formatDate(cell.at, lang)}
              </Text>
              <Text size={13} weight="medium">
                {formatTime(cell.at)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  cell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  cellLeft: { borderRightWidth: 1, borderRightColor: colors.border },
  cellTop: { borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 28, alignItems: 'center' },
});

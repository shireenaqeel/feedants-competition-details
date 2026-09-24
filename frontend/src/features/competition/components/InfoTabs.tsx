import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Competition } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { StringKey } from '@/i18n/strings';
import { colors } from '@/theme';

type TabKey = 'about' | 'judging' | 'rules';
const TABS: { key: TabKey; label: StringKey }[] = [
  { key: 'about', label: 'tabAbout' },
  { key: 'judging', label: 'tabJudging' },
  { key: 'rules', label: 'tabRules' },
];
const COLLAPSED_LINES = 3;

export function InfoTabs({ content }: { content: Competition['content'] }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabKey>('about');
  const [expanded, setExpanded] = useState(false);

  const lines: string[] =
    tab === 'about'
      ? content.about.split('\n').filter(Boolean)
      : tab === 'judging'
        ? content.judgingParameters.map((p) => (p.weight !== null ? `${p.title} (${p.weight}%)` : p.title))
        : content.rulesEligibility.map((r) => `• ${r}`);
  const visible = expanded ? lines : lines.slice(0, COLLAPSED_LINES);

  return (
    <Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent} accessibilityRole="tablist">
        {TABS.map(({ key, label }) => {
          const active = key === tab;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setTab(key);
                setExpanded(false);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text size={12.5} weight={active ? 'semibold' : 'medium'} color={active ? colors.primary : colors.textMuted} align="center" numberOfLines={1}>
                {t(label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ marginTop: 12, gap: 2 }}>
        {visible.map((line, i) => (
          <Text key={`${tab}-${i}`} size={13} color={colors.textMuted}>
            {line}
          </Text>
        ))}
      </View>
      {lines.length > COLLAPSED_LINES && (
        <Pressable accessibilityRole="button" onPress={() => setExpanded((v) => !v)} style={styles.more} hitSlop={8}>
          <Text size={13} weight="medium" color={colors.primary}>
            {expanded ? t('viewLess') : t('viewMore')}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsContent: { flexGrow: 1, justifyContent: 'space-between', gap: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
});

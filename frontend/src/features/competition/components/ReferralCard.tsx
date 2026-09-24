import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import type { Referral } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatMoney } from '@/lib/format';
import { colors, radius } from '@/theme';

interface ReferralCardProps {
  referral: Referral | undefined;
  rewardPerSignup: number;
  competitionTitle: string;
  onLogin: () => void;
}

export function ReferralCard({ referral, rewardPerSignup, competitionTitle, onLogin }: ReferralCardProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    if (!referral) return;
    await Clipboard.setStringAsync(referral.link);
    setCopied(true);
  };

  const share = () => {
    if (!referral) return onLogin();
    void Share.share({ message: t('shareMessage', { title: competitionTitle, link: referral.link }) });
  };

  return (
    <View style={styles.card}>
      <MaterialCommunityIcons name="bullhorn-outline" size={40} color={colors.primary} style={styles.icon} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text size={14} weight="semibold">
          {t('referTitle')}
        </Text>
        {referral ? (
          <View style={styles.linkRow}>
            <Text size={10.5} numberOfLines={1} ellipsizeMode="middle" style={styles.link} selectable>
              {referral.link}
            </Text>
            <Pressable accessibilityRole="button" onPress={copy} style={styles.copy}>
              <Text size={11} weight="semibold" color={colors.primary}>
                {copied ? t('copied') : t('copyLink')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onLogin}>
            <Text size={12} weight="medium" color={colors.primary}>
              {t('loginForReferral')}
            </Text>
          </Pressable>
        )}
      </View>
      <View style={styles.right}>
        <Button label={t('referNow')} size="sm" onPress={share} style={{ alignSelf: 'stretch' }} />
        {rewardPerSignup > 0 && (
          <Text size={10} color={colors.primary} align="center">
            {t('youEarn')} <Text size={11} weight="bold" color={colors.primary}>{formatMoney(rewardPerSignup).replace(' ', '')}</Text> {t('forEverySignup')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.referralBg, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.primaryBorder },
  icon: { transform: [{ rotate: '-12deg' }] },
  linkRow: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, overflow: 'hidden' },
  link: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  copy: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingHorizontal: 8, justifyContent: 'center' },
  right: { width: 100, gap: 4, alignItems: 'center' },
});

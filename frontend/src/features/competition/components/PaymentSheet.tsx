import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { countdownParts, formatMoney, formatShortDuration } from '@/lib/format';
import { colors, radius } from '@/theme';
import type { PendingPayment } from '../hooks/useRegistrationFlow';

interface PaymentSheetProps {
  pending: PendingPayment | null;
  competitionTitle: string;
  now: number;
  paying: boolean;
  onPay: () => void;
  onCancel: () => void;
  onClose: () => void;
}

/** Checkout step. In mock mode this stands in for the Razorpay sheet. */
export function PaymentSheet({ pending, competitionTitle, now, paying, onPay, onCancel, onClose }: PaymentSheetProps) {
  const { t } = useLanguage();
  const heldUntil = pending?.registration.holdExpiresAt;
  const left = heldUntil ? countdownParts(new Date(heldUntil).getTime() - now) : null;

  return (
    <Sheet visible={Boolean(pending)} onClose={onClose} dismissable={!paying}>
      {pending && (
        <View style={{ gap: 14 }}>
          <Text size={18} weight="semibold">
            {t('paymentTitle')}
          </Text>
          <View style={styles.summary}>
            <Text size={14} weight="medium">
              {competitionTitle}
            </Text>
            <View style={styles.amountRow}>
              <Text color={colors.textMuted}>{t('paymentAmount')}</Text>
              <Text size={20} weight="bold" color={colors.primary}>
                {formatMoney(pending.order.amount)}
              </Text>
            </View>
          </View>
          {left && (
            <View style={styles.held}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text size={13} color={colors.primary} weight="medium">
                {t('paymentHeld', { time: formatShortDuration(left) })}
              </Text>
            </View>
          )}
          <Button label={t('payNow', { amount: formatMoney(pending.order.amount) })} onPress={onPay} loading={paying} disabled={left?.done} />
          <Button label={t('releaseSpot')} variant="ghost" onPress={onCancel} disabled={paying} />
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
            <Text size={11} color={colors.textMuted}>
              {t('securePayments')} Razorpay · {t('paymentTestMode')}
            </Text>
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.background, borderRadius: radius.md, padding: 14, gap: 8 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  held: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
});

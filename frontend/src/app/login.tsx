import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { TextField } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { errorMessage } from '@/features/competition/errors';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

type Mode = 'login' | 'signup';

const DEMO_ACCOUNTS = [
  { labelKey: 'demoParticipant', phone: '9999999999' },
  { labelKey: 'demoOrganizer', phone: '8888888888' },
] as const;

/** Log in (existing account) or sign up (new, empty profile). Opened as /login?mode=signup|login. */
export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { t } = useLanguage();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [suggest, setSuggest] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setSuggest(null);
  };

  const submit = async () => {
    const digits = phone.replace(/\D/g, '');
    const next: typeof errors = {};
    if (mode === 'signup' && !name.trim()) next.name = t('nameRequired');
    if (digits.length < 10 || digits.length > 15) next.phone = t('invalidPhone');
    setErrors(next);
    setSuggest(null);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      if (mode === 'signup') await signup(name.trim(), digits);
      else await login(digits);
      router.back();
    } catch (e) {
      // Wrong screen for this number: offer the other one.
      if (e instanceof ApiError && e.code === 'ACCOUNT_NOT_FOUND') setSuggest('signup');
      if (e instanceof ApiError && e.code === 'PHONE_TAKEN') setSuggest('login');
      setErrors({ form: errorMessage(e, t) });
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === 'signup';
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top + 12 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-end' }}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>

        <View style={styles.logo}>
          <Ionicons name="trophy" size={28} color="#fff" />
        </View>
        <Text size={24} weight="bold">
          {isSignup ? t('signupTitle') : t('loginWelcome')}
        </Text>
        <Text color={colors.textMuted}>{isSignup ? t('signupSubtitle') : t('loginWelcomeSub')}</Text>

        <View style={styles.segment} accessibilityRole="tablist">
          {(['login', 'signup'] as const).map((m) => (
            <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => switchMode(m)} style={[styles.segmentItem, mode === m && styles.segmentActive]}>
              <Text size={14} weight="semibold" color={mode === m ? colors.primary : colors.textMuted}>
                {m === 'login' ? t('logIn') : t('signUp')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 14 }}>
          {isSignup && <TextField label={t('fieldName')} value={name} onChangeText={setName} autoComplete="name" maxLength={60} error={errors.name} />}
          <TextField
            label={t('phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={15}
            placeholder="98765 43210"
            error={errors.phone}
            onSubmitEditing={submit}
            prefix={<Text weight="medium" color={colors.textMuted}>+91</Text>}
          />
          {errors.form && (
            <View style={styles.formError}>
              <Text size={13} color={colors.danger}>
                {errors.form}
              </Text>
              {suggest && (
                <Pressable accessibilityRole="button" onPress={() => switchMode(suggest)}>
                  <Text size={13} weight="semibold" color={colors.primary}>
                    {suggest === 'signup' ? t('signUp') : t('logIn')} →
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          <Button label={isSignup ? t('createAccount') : t('logIn')} onPress={submit} loading={loading} />
          <Pressable accessibilityRole="button" onPress={() => switchMode(isSignup ? 'login' : 'signup')} style={{ alignSelf: 'center' }}>
            <Text size={13} color={colors.textMuted}>
              {isSignup ? t('haveAccount') : t('noAccount')}{' '}
              <Text size={13} weight="semibold" color={colors.primary}>
                {isSignup ? t('logIn') : t('signUp')}
              </Text>
            </Text>
          </Pressable>
          <Text size={11} color={colors.textSubtle} align="center">
            {t('noOtpNote')}
          </Text>
        </View>

        {!isSignup && (
          <View style={styles.demo}>
            <Text size={12} color={colors.textMuted}>
              {t('demoAccounts')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {DEMO_ACCOUNTS.map((d) => (
                <Pressable key={d.phone} accessibilityRole="button" onPress={() => setPhone(d.phone)} style={styles.demoChip}>
                  <Text size={12} weight="medium" color={colors.primary}>
                    {t(d.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.chip, borderRadius: radius.md, padding: 4, marginVertical: 8 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface },
  formError: { gap: 4, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: 10 },
  demo: { marginTop: 24, gap: 8, alignItems: 'center', paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  demoChip: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
});

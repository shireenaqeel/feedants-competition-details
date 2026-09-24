import { View } from 'react-native';
import { useLanguage } from '@/i18n/LanguageProvider';
import { FieldLabel, TextField } from './Field';

export interface LocalizedValue {
  en: string;
  hi: string;
}

interface Props {
  label: string;
  hint?: string;
  value: LocalizedValue;
  onChange: (value: LocalizedValue) => void;
  error?: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
}

/** English (required) + Hindi (optional; the API falls back to English). */
export function LocalizedField({ label, hint, value, onChange, error, multiline, maxLength, placeholder }: Props) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel label={label} hint={hint} />
      <TextField
        placeholder={placeholder ?? t('english')}
        value={value.en}
        onChangeText={(en) => onChange({ ...value, en })}
        error={error}
        multiline={multiline}
        maxLength={maxLength}
      />
      <TextField placeholder={t('hindiOptional')} value={value.hi} onChangeText={(hi) => onChange({ ...value, hi })} multiline={multiline} maxLength={maxLength} />
    </View>
  );
}

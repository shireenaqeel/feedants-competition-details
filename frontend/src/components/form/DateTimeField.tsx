import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDate, formatTime } from '@/lib/format';
import { colors, radius } from '@/theme';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { Text } from '../ui/Text';
import { FieldError, FieldLabel, TextField } from './Field';

interface Props {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Native date + time picker: an inline picker in a sheet on iOS, the two system dialogs
 * (date, then time) on Android, and a plain "YYYY-MM-DD HH:mm" field in the web preview.
 */
export function DateTimeField({ label, value, onChange, error }: Props) {
  const { t, lang } = useLanguage();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [webText, setWebText] = useState(toLocalInput(value));

  if (Platform.OS === 'web') {
    return (
      <TextField
        label={label}
        value={webText}
        placeholder="YYYY-MM-DD HH:mm"
        error={error}
        onChangeText={(text) => {
          setWebText(text);
          const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(text.trim());
          if (m) onChange(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
        }}
      />
    );
  }

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        onValueChange: (_e, date) => {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onValueChange: (_e2, time) => onChange(time),
          });
        },
      });
    } else {
      setDraft(value);
      setIosOpen(true);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <FieldLabel label={label} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${formatDate(value, lang)} ${formatTime(value)}`} onPress={open} style={[styles.box, error && { borderColor: colors.danger }]}>
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text size={14} weight="medium" style={{ flex: 1 }}>
          {formatDate(value, lang)} · {formatTime(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSubtle} />
      </Pressable>
      <FieldError message={error} />
      {Platform.OS === 'ios' && (
        <Sheet visible={iosOpen} onClose={() => setIosOpen(false)}>
          <Text size={16} weight="semibold">
            {label}
          </Text>
          <DateTimePicker value={draft} mode="datetime" display="inline" accentColor={colors.primary} onValueChange={(_e, d) => setDraft(d)} />
          <Button
            label={t('done')}
            onPress={() => {
              onChange(draft);
              setIosOpen(false);
            }}
          />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 46, backgroundColor: colors.surface },
});

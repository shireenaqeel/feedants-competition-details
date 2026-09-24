import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { uploadImage } from '@/api/upload';
import { errorMessage } from '@/features/competition/errors';
import { useLanguage } from '@/i18n/LanguageProvider';
import { notify } from '@/lib/confirm';
import { colors } from '@/theme';
import { Text } from '../ui/Text';
import { FieldLabel } from './Field';

/** Opens the photo library, crops square, uploads, and reports the stored path + a preview URL. */
export async function pickAndUploadImage(t: ReturnType<typeof useLanguage>['t']): Promise<{ path: string; url: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    notify(t('permissionNeeded'), t('permissionBody'));
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  try {
    return await uploadImage({ uri: asset.uri, name: asset.fileName ?? `photo.${mimeType.split('/')[1] ?? 'jpg'}`, mimeType });
  } catch (e) {
    notify(t('somethingWrong'), errorMessage(e, t));
    return null;
  }
}

interface Props {
  label: string;
  /** URL to show (absolute), or null. */
  previewUrl: string | null;
  onChange: (value: { path: string; url: string } | null) => void;
}

export function ImageField({ label, previewUrl, onChange }: Props) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setBusy(true);
    const uploaded = await pickAndUploadImage(t);
    setBusy(false);
    if (uploaded) onChange(uploaded);
  };

  return (
    <View style={{ gap: 6 }}>
      <FieldLabel label={label} />
      <View style={styles.row}>
        <View style={styles.preview}>
          {previewUrl ? <Image source={previewUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="person" size={32} color={colors.textSubtle} />}
          {busy && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} />}
        </View>
        <View style={{ gap: 6 }}>
          <Pressable accessibilityRole="button" onPress={choose} disabled={busy}>
            <Text size={13} weight="semibold" color={colors.primary}>
              {previewUrl ? t('changePhoto') : t('choosePhoto')}
            </Text>
          </Pressable>
          {previewUrl && (
            <Pressable accessibilityRole="button" onPress={() => onChange(null)} disabled={busy}>
              <Text size={13} color={colors.danger}>
                {t('removePhoto')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  preview: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

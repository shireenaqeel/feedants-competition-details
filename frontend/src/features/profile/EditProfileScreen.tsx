import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { TextField } from '@/components/form/Field';
import { pickAndUploadImage } from '@/components/form/ImageField';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { errorMessage } from '@/features/competition/errors';
import { useLanguage } from '@/i18n/LanguageProvider';
import { notify } from '@/lib/confirm';
import { colors } from '@/theme';

export function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  // undefined = unchanged, null = removed, string = newly uploaded path
  const [avatarPath, setAvatarPath] = useState<string | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;

  const choosePhoto = async () => {
    setUploading(true);
    const uploaded = await pickAndUploadImage(t);
    setUploading(false);
    if (uploaded) {
      setAvatarPath(uploaded.path);
      setAvatarPreview(uploaded.url);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setErrors({ name: t('required') });
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await endpoints.updateMe({
        name: name.trim(),
        city: city.trim(),
        bio: bio.trim(),
        ...(avatarPath !== undefined && { avatarUrl: avatarPath }),
      });
      setUser(updated);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      router.back();
      notify(t('profileSaved'));
    } catch (e) {
      if (e instanceof ApiError && e.details.length) setErrors(Object.fromEntries(e.details.map((d) => [d.path, d.message])));
      else notify(t('somethingWrong'), errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text size={17} weight="semibold" style={{ flex: 1 }}>
          {t('editProfile')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            {avatarPreview ? (
              <Image source={avatarPreview} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={44} color={colors.primary} />
            )}
            {uploading && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable accessibilityRole="button" onPress={choosePhoto} disabled={uploading}>
              <Text weight="semibold" color={colors.primary}>
                {avatarPreview ? t('changePhoto') : t('choosePhoto')}
              </Text>
            </Pressable>
            {avatarPreview && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setAvatarPath(null);
                  setAvatarPreview(null);
                }}
              >
                <Text color={colors.danger}>{t('removePhoto')}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <TextField label={t('fieldName')} value={name} onChangeText={setName} maxLength={60} error={errors['name']} autoComplete="name" />
        <TextField label={t('fieldCity')} value={city} onChangeText={setCity} maxLength={60} error={errors['city']} />
        <TextField
          label={t('fieldBio')}
          hint={`${bio.length}/300`}
          placeholder={t('bioPlaceholder')}
          value={bio}
          onChangeText={setBio}
          maxLength={300}
          multiline
          error={errors['bio']}
        />
        <TextField label={t('phone')} value={`+91 ${user.phone}`} editable={false} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button label={t('save')} onPress={save} loading={saving} disabled={uploading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  content: { padding: 16, gap: 16 },
  avatarBlock: { alignItems: 'center', gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
});

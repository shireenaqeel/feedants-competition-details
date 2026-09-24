import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';
import { queryKeys } from '@/api/queryClient';
import { uploadSubmission } from '@/api/upload';
import { useLanguage } from '@/i18n/LanguageProvider';
import { errorMessage } from '../errors';

export function useSubmissionUpload(slug: string, competitionId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [progress, setProgress] = useState<number | null>(null);

  const pickAndUpload = async () => {
    if (!competitionId || progress !== null) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('permissionNeeded'), t('permissionBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 1 });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'video/mp4';
    const name = asset.fileName ?? `submission.${mimeType.split('/')[1] ?? 'mp4'}`;

    setProgress(0);
    try {
      await uploadSubmission(competitionId, { uri: asset.uri, name, mimeType }, setProgress);
      Alert.alert(t('uploadSuccess'), t('uploadSuccessBody'));
    } catch (error) {
      Alert.alert(t('somethingWrong'), errorMessage(error, t));
    } finally {
      setProgress(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.competitionAll(slug) });
    }
  };

  return { pickAndUpload, progress };
}

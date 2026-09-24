import { Platform } from 'react-native';
import { API_URL } from '@/config/api';
import { ApiError, authHeaders, handleErrorResponse } from './client';
import type { Submission } from './types';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

async function formWithFile(file: PickedFile): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', blob, file.name);
  } else {
    // React Native's FormData accepts { uri, name, type } and streams the file from disk.
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  return form;
}

/**
 * Multipart upload through XMLHttpRequest. On iOS/Android, Expo replaces the global `fetch` with
 * `expo/fetch`, which does not support React Native's `{ uri }` file parts; XHR does (and it also
 * reports upload progress).
 */
function sendMultipart<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/v1${path}`);
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader('Accept', 'application/json');
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Network request failed'));
    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error body
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload as T);
      else handleErrorResponse(xhr.status, payload).catch(reject);
    };
    xhr.send(form);
  });
}

/** Uploads a photo; returns the path to store (e.g. as avatarUrl) and a URL to display. */
export async function uploadImage(file: PickedFile): Promise<{ path: string; url: string }> {
  return sendMultipart('/uploads/images', await formWithFile(file));
}

/** Uploads (or replaces) a competition entry, reporting progress. */
export async function uploadSubmission(competitionId: string, file: PickedFile, onProgress: (fraction: number) => void): Promise<Submission> {
  const { submission } = await sendMultipart<{ submission: Submission }>(`/competitions/${competitionId}/submissions`, await formWithFile(file), onProgress);
  return submission;
}

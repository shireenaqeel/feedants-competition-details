import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

// Resolves the backend URL:
// 1. EXPO_PUBLIC_API_URL if set (staging/production or a custom setup).
// 2. In development on a device/emulator, the host running Metro (from Expo's hostUri),
//    so a phone running Expo Go reaches the computer's LAN IP without manual config.
// 3. localhost (web / iOS simulator).
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.5:8081"
  const host = hostUri?.split(':')[0];
  if (Platform.OS !== 'web' && host) return `http://${host}:${API_PORT}`;

  return `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

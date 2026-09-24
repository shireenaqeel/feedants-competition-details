import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function CompetitionsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

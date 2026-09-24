import { useLocalSearchParams } from 'expo-router';
import { PublicProfileScreen } from '@/features/profile/PublicProfileScreen';

export default function PublicProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PublicProfileScreen userId={id} />;
}

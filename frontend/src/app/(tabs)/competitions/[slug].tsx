import { useLocalSearchParams } from 'expo-router';
import { CompetitionDetailsScreen } from '@/features/competition/CompetitionDetailsScreen';

export default function CompetitionDetailsRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <CompetitionDetailsScreen slug={slug} />;
}

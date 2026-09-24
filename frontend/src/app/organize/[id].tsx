import { useLocalSearchParams } from 'expo-router';
import { CompetitionFormScreen } from '@/features/organizer/CompetitionFormScreen';

export default function EditCompetitionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CompetitionFormScreen competitionId={id} />;
}

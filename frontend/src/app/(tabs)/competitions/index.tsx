import { useLocalSearchParams } from 'expo-router';
import { CATEGORIES, type Category } from '@/api/types';
import { CompetitionListScreen } from '@/features/competition/CompetitionListScreen';

export default function CompetitionsScreen() {
  // Home's category shortcuts open this tab with ?category=…; a new category remounts with that filter.
  const { category } = useLocalSearchParams<{ category?: string }>();
  const initial = CATEGORIES.includes(category as Category) ? (category as Category) : undefined;
  return <CompetitionListScreen key={initial ?? 'all'} initialCategory={initial} />;
}

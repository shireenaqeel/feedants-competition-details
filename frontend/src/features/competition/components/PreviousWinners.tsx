import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { Winner } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { ordinal } from '@/lib/format';
import { colors, radius } from '@/theme';

export function PreviousWinners({ winners, onPlay }: { winners: Winner[]; onPlay: (w: Winner) => void }) {
  const { t, lang } = useLanguage();
  if (!winners.length) return null;
  return (
    <Card style={{ paddingHorizontal: 0 }}>
      <Text size={15} weight="semibold" style={{ marginBottom: 10, paddingHorizontal: 14 }}>
        {t('previousWinners')}
      </Text>
      <FlatList
        horizontal
        data={winners}
        keyExtractor={(w) => w.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${t('positionWinner', { pos: ordinal(item.position, lang) })}`}
            disabled={!item.videoUrl}
            onPress={() => onPlay(item)}
            style={styles.item}
          >
            <View>
              <Image source={item.avatarUrl ?? undefined} style={styles.photo} contentFit="cover" transition={150} />
              {item.videoUrl && (
                <View style={styles.play}>
                  <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
                </View>
              )}
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text size={13} weight="medium" numberOfLines={1}>
                {item.name}
              </Text>
              <Text size={12} color={colors.primary}>
                {t('positionWinner', { pos: ordinal(item.position, lang) })}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: radius.md, paddingRight: 12, width: 180 },
  photo: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.chip },
  play: { position: 'absolute', bottom: 6, alignSelf: 'center', width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Testimonial } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

export function TestimonialsRow({ testimonials }: { testimonials: Testimonial[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!testimonials.length) return null;
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Card style={styles.row}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text size={14} weight="semibold">
              {t('hearFromUsers')}
            </Text>
            <Text size={11} color={colors.textMuted}>
              {t('hearFromUsersSub')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Card>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text size={17} weight="semibold" style={{ marginBottom: 12 }}>
          {t('hearFromUsers')}
        </Text>
        <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
          {testimonials.map((item) => (
            <View key={item.id} style={styles.item}>
              <Image source={item.avatarUrl ?? undefined} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text size={13} weight="semibold">
                    {item.userName}
                  </Text>
                  {item.rating ? (
                    <Text size={12} color={colors.gold}>
                      {'★'.repeat(item.rating)}
                    </Text>
                  ) : null}
                </View>
                <Text size={13} color={colors.textMuted}>
                  {item.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  item: { flexDirection: 'row', gap: 10, backgroundColor: colors.background, borderRadius: radius.md, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chip },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

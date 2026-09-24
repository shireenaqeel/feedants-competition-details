import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { StringKey } from '@/i18n/strings';
import { colors, radius } from '@/theme';
import { Text } from './ui/Text';

const TAB_LABELS: Record<string, StringKey | null> = {
  index: 'tabHome',
  create: null, // centre "+" button
  competitions: 'tabCompetitions',
  profile: 'tabProfile',
};

/** Bottom bar from the design: Home · Explore · (+) · Competitions · Profile. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        if (!(route.name in TAB_LABELS)) return null;
        const focused = state.index === index;
        const color = focused ? colors.primary : colors.textSubtle;
        const labelKey = TAB_LABELS[route.name];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        if (labelKey === null) {
          return (
            <Pressable key={route.key} accessibilityRole="button" accessibilityLabel="Create" onPress={onPress} style={styles.item}>
              <View style={styles.create}>
                <Ionicons name="add-circle-outline" size={28} color="#fff" />
              </View>
            </Pressable>
          );
        }

        let icon;
        if (route.name === 'index') icon = <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />;
        else if (route.name === 'competitions') icon = <MaterialCommunityIcons name={focused ? 'trophy' : 'trophy-outline'} size={24} color={color} />;
        else
          icon = user?.avatarUrl ? (
            <Image source={user.avatarUrl} style={[styles.avatar, focused && { borderColor: colors.primary }]} />
          ) : (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={26} color={color} />
          );

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            {icon}
            <Text size={11} weight={focused ? 'semibold' : 'regular'} color={color}>
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  create: { width: 52, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'transparent' },
});

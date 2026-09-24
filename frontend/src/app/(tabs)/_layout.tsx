import { Tabs } from 'expo-router/tabs';
import { TabBar } from '@/components/TabBar';

// Order = tab bar order: Home · Competitions · (+) Organize · Profile.
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      {/* Leaving the tab resets it: coming back shows the full list, not the last competition opened. */}
      <Tabs.Screen name="competitions" options={{ popToTopOnBlur: true }} />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

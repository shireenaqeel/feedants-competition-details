import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { youtubeId } from '@/lib/video';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { Text } from './Text';
import { YouTubePlayer } from './YouTubePlayer';

interface VideoModalProps {
  url: string | null;
  title?: string;
  onClose: () => void;
}

/**
 * Full-screen player. Direct media (mp4, HLS) plays in the native player; YouTube links play in
 * YouTube's embedded player. Created when a URL is set and released when the modal closes.
 */
export function VideoModal({ url, title, onClose }: VideoModalProps) {
  return (
    <Modal visible={Boolean(url)} animationType="fade" transparent onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      {url ? <Player url={url} title={title} onClose={onClose} /> : null}
    </Modal>
  );
}

function Player({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const ytId = youtubeId(url);
  return (
    <View style={[styles.backdrop, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text weight="semibold" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
          {title ?? ''}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close video" onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>
      {ytId ? <YouTubePlayer videoId={ytId} /> : <NativeVideo url={url} />}
    </View>
  );
}

function NativeVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });
  return <VideoView player={player} style={styles.video} nativeControls fullscreenOptions={{ enable: true }} contentFit="contain" />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  video: { flex: 1, backgroundColor: colors.text },
});

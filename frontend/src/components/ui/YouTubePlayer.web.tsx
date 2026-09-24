import { createElement } from 'react';
import { View } from 'react-native';
import { youtubeEmbedUrl } from '@/lib/video';

/** Web preview: a plain iframe (react-native-webview has no web implementation). */
export function YouTubePlayer({ videoId }: { videoId: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {createElement('iframe', {
        src: youtubeEmbedUrl(videoId),
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowFullScreen: true,
        style: { border: 0, width: '100%', height: '100%' },
      })}
    </View>
  );
}

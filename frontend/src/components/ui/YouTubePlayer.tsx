import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { youtubeEmbedUrl } from '@/lib/video';

// YouTube links are web pages, so they play in YouTube's embedded player. The embed must be
// loaded from a page with a real https origin (baseUrl), or YouTube refuses to play (error 153).
const html = (id: string) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body>
<iframe src="${youtubeEmbedUrl(id)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</body></html>`;

export function YouTubePlayer({ videoId }: { videoId: string }) {
  return (
    <WebView
      source={{ html: html(videoId), baseUrl: 'https://feedants.com' }}
      style={styles.web}
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      javaScriptEnabled
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#000' },
});

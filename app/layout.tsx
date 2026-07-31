import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spotify Playlist Creator | 音楽ファイルから自動プレイリスト作成",
  description: "ローカルの音楽ファイル名からSpotifyプレイリストを自動作成。日本の楽曲に最適化された検索機能で、簡単にお気に入りのプレイリストを作成できます。",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}

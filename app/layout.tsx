import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spotify Playlist Creator | 音楽ファイルから自動プレイリスト作成",
  description: "ローカルの音楽ファイル名からSpotifyプレイリストを自動作成。日本の楽曲に最適化された検索機能で、簡単にお気に入りのプレイリストを作成できます。",
  keywords: "Spotify, プレイリスト, 音楽, 自動作成, 日本, playlist creator",
  authors: [{ name: "Andex Tokyo" }],
  openGraph: {
    title: "Spotify Playlist Creator",
    description: "音楽ファイルから自動でSpotifyプレイリストを作成",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "Spotify Playlist Creator",
    description: "音楽ファイルから自動でSpotifyプレイリストを作成",
  },
};;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

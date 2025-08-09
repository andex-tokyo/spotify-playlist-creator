# Spotify Playlist Creator

ローカルの音楽ファイルのファイル名を基に、自動的にSpotifyプレイリストを作成するWebアプリケーション。

## 🌟 特徴

- 🎵 音楽ファイル（.mp3, .m4a, .flac, .wav）から曲名を自動抽出
- 🔍 Spotify APIで楽曲を検索
- 🎧 30秒プレビュー再生で楽曲を確認
- 🇯🇵 日本の楽曲を優先検索するオプション
- 📅 リリース年代でフィルタリング
- ⭐ 人気度でフィルタリング
- ✅ 複数の検索結果から正しい楽曲を選択
- 🚀 **音楽ファイルはアップロードされません**（ファイル名のみ使用）

## 🔒 プライバシーとセキュリティ

**重要**: このアプリケーションは音楽ファイル自体をサーバーにアップロードしません。
- ファイル名のみを使用して楽曲を検索
- 音楽ファイルの内容は一切送信されない
- すべての処理はブラウザ内で完結
- 通信量を最小限に抑えた設計

## 🚀 デプロイ方法

### 1. Spotify App の作成

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)にアクセス
2. "Create app"をクリック
3. 以下の情報を入力：
   - **App name**: 任意の名前（例: Spotify Playlist Creator）
   - **App description**: 任意の説明
   - **Redirect URIs**: 
     - 開発環境: `http://localhost:3000/api/auth/callback/spotify`
     - 本番環境: `https://your-app.vercel.app/api/auth/callback/spotify`
4. "Web API"にチェックを入れて作成
5. Settings画面でClient IDとClient Secretを確認

### 2. Vercelへのデプロイ

#### 方法1: ワンクリックデプロイ
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/spotify-playlist-creator&env=NEXTAUTH_URL,NEXTAUTH_SECRET,SPOTIFY_CLIENT_ID,SPOTIFY_CLIENT_SECRET)

#### 方法2: 手動デプロイ
```bash
# Vercel CLIをインストール
npm install -g vercel

# デプロイ
vercel

# 環境変数を設定（Vercelダッシュボードから）
```

### 3. 環境変数の設定

Vercelのダッシュボード > Settings > Environment Variables で以下を設定：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `NEXTAUTH_URL` | アプリのURL | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | 認証用シークレット | ランダムな文字列（下記参照） |
| `SPOTIFY_CLIENT_ID` | Spotify AppのClient ID | `1234567890abcdef...` |
| `SPOTIFY_CLIENT_SECRET` | Spotify AppのClient Secret | `abcdef1234567890...` |

**NEXTAUTH_SECRETの生成方法:**
```bash
openssl rand -base64 32
```

## 💻 ローカル開発

### 必要な環境
- Node.js 18以上
- npm または yarn

### セットアップ

1. **リポジトリをクローン**
```bash
git clone https://github.com/yourusername/spotify-playlist-creator.git
cd spotify-playlist-creator
```

2. **依存関係をインストール**
```bash
npm install
```

3. **環境変数を設定**
```bash
cp .env.local.example .env.local
# .env.localファイルを編集して、Spotifyの認証情報を設定
```

4. **開発サーバーを起動**
```bash
npm run dev
```

5. **ブラウザで開く**
```
http://localhost:3000
```

## 📖 使い方

1. **Spotifyでログイン**
   - "Sign in with Spotify"ボタンをクリック
   - Spotifyアカウントでログイン

2. **音楽ファイルを選択**
   - "Upload Music Files"から複数の音楽ファイルを選択
   - 対応形式: .mp3, .m4a, .flac, .wav

3. **プレイリスト名を設定**
   - デフォルトは"My Spotify Playlist"
   - 任意の名前に変更可能

4. **フィルターを設定**（オプション）
   - **Prefer Japanese**: 日本の楽曲を優先
   - **Year from/to**: リリース年代で絞り込み
   - **Min popularity**: 最低人気度を設定

5. **楽曲を検索**
   - "Search Tracks"ボタンをクリック
   - 各ファイルに対して最大5件の候補が表示

6. **楽曲を選択**
   - 各候補の再生ボタンで30秒プレビュー
   - 正しい楽曲をクリックして選択

7. **プレイリストを作成**
   - "Create Playlist"ボタンをクリック
   - Spotifyでプレイリストが自動的に開く

## 🛠️ 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **認証**: NextAuth.js
- **スタイリング**: Tailwind CSS
- **言語**: TypeScript
- **API**: Spotify Web API
- **デプロイ**: Vercel

## 📝 ライセンス

MIT License

## 🤝 貢献

プルリクエストを歓迎します！大きな変更を加える場合は、まずイシューを作成して変更内容を説明してください。

## ⚠️ 注意事項

- Spotify Premiumアカウントでないと、プレビュー再生が制限される場合があります
- 一度に大量のファイルを処理すると、Spotify APIのレート制限に達する可能性があります
- ファイル名が正確でない場合、正しい楽曲が見つからない可能性があります

## 🐛 既知の問題

- 日本語のファイル名の場合、検索精度が低下することがあります
- 同名異曲の場合、正しい楽曲を見つけるのが困難な場合があります

## 📮 サポート

問題や提案がある場合は、[GitHubのIssues](https://github.com/yourusername/spotify-playlist-creator/issues)で報告してください。

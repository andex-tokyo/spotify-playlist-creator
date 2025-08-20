# CLAUDE.md - Serenaツール使用ガイド

このプロジェクトでは、効率的なコード理解と編集のためにSerenaツールセットを使用します。

## Serenaツールの基本原則

### 1. 効率的なコード読み取り
- **ファイル全体を読まない**: `Read`ツールでファイル全体を読むのは最終手段
- **シンボル単位で読む**: 必要な関数やクラスのみを読み取る
- **階層的に探索**: まず概要を把握してから詳細へ

### 2. 推奨されるワークフロー

#### コード理解フロー
```
1. mcp__serena__list_dir - ディレクトリ構造の把握
2. mcp__serena__get_symbols_overview - ファイル内のシンボル概要取得
3. mcp__serena__find_symbol - 特定シンボルの詳細取得
4. mcp__serena__find_referencing_symbols - シンボルの使用箇所確認
```

#### コード編集フロー
```
1. mcp__serena__find_symbol - 編集対象の特定
2. mcp__serena__replace_symbol_body - シンボル全体の置換
   または
   Edit/MultiEdit - 部分的な編集
3. mcp__serena__find_referencing_symbols - 影響範囲の確認
```

## 具体的な使用例

### 例1: 関数の実装を理解する
```bash
# ❌ 非推奨: ファイル全体を読む
Read file_path="/app/page.tsx"

# ✅ 推奨: 必要な関数のみ読む
mcp__serena__find_symbol name_path="searchTracks" relative_path="app/page.tsx" include_body=true
```

### 例2: クラスのメソッドを探索する
```bash
# まずクラスの概要を取得
mcp__serena__find_symbol name_path="PlaylistCreator" depth=1 include_body=false

# 特定のメソッドを読む
mcp__serena__find_symbol name_path="PlaylistCreator/handleSubmit" include_body=true
```

### 例3: コードの使用箇所を探す
```bash
# 関数がどこで使われているか確認
mcp__serena__find_referencing_symbols name_path="searchTracks" relative_path="app/page.tsx"
```

### 例4: パターン検索
```bash
# 特定のパターンを含むコードを検索
mcp__serena__search_for_pattern substring_pattern="useState\\(" restrict_search_to_code_files=true
```

## メモリファイルの活用

以下のメモリファイルが利用可能です：
- `project_overview` - プロジェクトの概要
- `suggested_commands` - 開発コマンド一覧
- `code_style_conventions` - コーディング規約
- `task_completion_checklist` - タスク完了時のチェックリスト
- `project_structure` - ディレクトリ構造

読み取り方法：
```bash
mcp__serena__read_memory memory_file_name="suggested_commands"
```

## タスク完了時の必須アクション

コード変更後は必ず以下を実行：

1. **Lintチェック**
   ```bash
   npm run lint
   ```

2. **ビルド確認**
   ```bash
   npm run build
   ```

3. **思考ツールの使用**
   ```bash
   mcp__serena__think_about_task_adherence  # 編集前
   mcp__serena__think_about_whether_you_are_done  # タスク完了時
   ```

## Serenaツール一覧

### 探索・読み取り
- `mcp__serena__list_dir` - ディレクトリ一覧
- `mcp__serena__find_file` - ファイル検索
- `mcp__serena__get_symbols_overview` - シンボル概要
- `mcp__serena__find_symbol` - シンボル詳細取得
- `mcp__serena__find_referencing_symbols` - 参照箇所検索
- `mcp__serena__search_for_pattern` - パターン検索

### 編集
- `mcp__serena__replace_symbol_body` - シンボル本体置換
- `mcp__serena__insert_before_symbol` - シンボル前に挿入
- `mcp__serena__insert_after_symbol` - シンボル後に挿入

### メモリ管理
- `mcp__serena__list_memories` - メモリ一覧
- `mcp__serena__read_memory` - メモリ読み取り
- `mcp__serena__write_memory` - メモリ書き込み
- `mcp__serena__delete_memory` - メモリ削除

### 思考支援
- `mcp__serena__think_about_collected_information` - 収集情報の確認
- `mcp__serena__think_about_task_adherence` - タスク遵守確認
- `mcp__serena__think_about_whether_you_are_done` - 完了確認

## 重要な注意事項

1. **ファイル全体を読まない** - Readツールは最終手段
2. **シンボルツールを優先** - コード理解にはシンボルベースのツールを使用
3. **メモリを活用** - プロジェクト情報は既にメモリに保存済み
4. **思考ツールを使う** - 複雑なタスクでは思考支援ツールを活用
5. **効率を重視** - 必要最小限の情報のみを読み取る

このガイドラインに従うことで、トークン効率的かつ正確なコード操作が可能になります。
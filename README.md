# Game Dev Assistant

Windows 向けゲーム開発支援デスクトップアプリ（Electron + React + TypeScript + Vite）

個人利用を想定しつつ、**保守性・拡張性**を優先した MVVM 構成です。

---

## 目次

1. [機能一覧](#機能一覧)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [初回セットアップ手順](#初回セットアップ手順)
4. [GitHub で必要な設定](#github-で必要な設定)
5. [Personal Access Token の設定](#personal-access-token-の設定)
6. [Secrets 登録方法](#secrets-登録方法)
7. [GitHub Release の使い方](#github-release-の使い方)
8. [運用方法](#運用方法)
9. [ローカル開発・ビルド](#ローカル開発ビルド)
10. [データ保持ポリシー](#データ保持ポリシー)

---

## 機能一覧

| 機能 | 内容 |
|------|------|
| Windows アプリ化 | electron-builder → `*-Setup.exe` |
| 自動アップデート | electron-updater + GitHub Releases |
| CI/CD | GitHub Actions（windows-latest）で Build → Release |
| 創作ツールハブ | ぽこぽこ等のツールをアプリ内表示 |
| Cursor 起動 | ワンクリック / フォルダ指定 |
| プロジェクト管理 | 最近開いたプロジェクト |
| Assets | 画像 / BGM / SE（D&D・サムネイル） |
| Prompt 管理 | 保存・検索・履歴 |
| Git GUI | Commit / Push / Pull / Branch / Release |
| ビルド実行 | Windows / Android |
| ログ | SQLite + `userData/logs/` ファイル |
| 設定 | GitHub / Channel / AutoUpdate / パス類 |
| プラグイン | 将来拡張用ホスト |
| Blender AI | 日本語チャットで Blender 操作（WS/JSON-RPC・テンプレート・OpenAI） |
| Unity AI | 日本語チャットで Unity Editor 操作（Bridge・ルールベース） |

---

## Blender AI の使い方

1. **設定** で `Blender.exe` を指定（見つからない場合は自動検出を試行）
2. サイドバー **Blender AI**（Ctrl+3）を開く
3. **Blender 起動** → ブリッジ接続（既定 `ws://127.0.0.1:8775` ※Unity とポート分離）
4. テンプレートをクリック、またはチャットで指示  
   例: `可愛い牧場少女を作成` / `夕焼けに変更` / `キューブを追加`
5. （任意）OpenAI API Key を設定すると、より柔軟な自然言語操作が可能

パッケージ時は Python ブリッジが `resources/blender-addon/` に同梱されます。

---

## Unity AI の使い方

1. Unity プロジェクトに同梱の `unity-package` を追加  
   （Package Manager → Add package from disk → `package.json`）
2. メニュー **Unity AI Controller → Start Bridge**（`ws://127.0.0.1:8765/unity/`）
3. サイドバー **Unity AI**（Ctrl+4）→ **接続**
4. クイックコマンドまたはチャット  
   例: `プレイヤーを追加` / `敵を10体生成` / `シーンを保存`

---

## ディレクトリ構成

```
.
├── src/
│   ├── main/                 # Electron メインプロセス
│   │   ├── database/         # SQLite (sql.js)
│   │   ├── logs/             # LogService + FileLogService
│   │   ├── settings/         # SettingsService
│   │   ├── updater/          # UpdaterService (electron-updater)
│   │   ├── plugins/          # PluginService
│   │   ├── services/         # Git / Assets / Hub / Watcher 等
│   │   ├── ipc/              # IPC ハンドラ
│   │   ├── main.ts
│   │   └── preload.ts
│   ├── renderer/             # React UI
│   │   ├── components/
│   │   ├── pages/            # View
│   │   ├── store/            # ViewModel
│   │   ├── services/         # ApiClient
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── assets/
│   │   └── plugins/
│   └── shared/               # 共有型・IPC
├── database/                 # ドキュメント用ポインタ
├── logs/                     # ドキュメント用ポインタ
├── settings/
├── plugins/
├── updater/
├── types/
├── .github/workflows/
│   └── release.yml           # main Push → Release 自動化
├── resources/
├── package.json
└── README.md
```

---

## 初回セットアップ手順

### 1. リポジトリ準備

1. GitHub で **空のリポジトリ** を作成（例: `game-dev-assistant`）
2. ローカルで:

```bash
cd /path/to/アプリケーション
git remote add origin https://github.com/<YOUR_OWNER>/game-dev-assistant.git
```

### 2. package.json の差し替え

次を **実際の GitHub アカウント/リポジトリ名** に変更してください。

- `repository.url`
- `build.publish[0].owner`
- `build.publish[0].repo`

アプリ設定画面の **GitHub Owner / Repository** も同じ値に合わせます。

### 3. 依存関係インストール

```bash
npm install
# electron / esbuild の install スクリプトがブロックされる場合:
npm approve-scripts electron esbuild
```

### 4. 開発起動

```bash
npm run dev
```

### 5. Windows インストーラ生成（ローカル）

```bash
npm run dist
```

成果物:

- `release/Game Dev Assistant-<version>-Setup.exe`

### 6. 初回 Push（CI で Release）

```bash
# package.json の version を確認（例: 1.0.0）
git add .
git commit -m "chore: initial windows desktop release pipeline"
git push -u origin main
```

Actions が走り、成功すると **GitHub Releases** に Setup.exe と `latest.yml` が公開されます。

---

## GitHub で必要な設定

| 項目 | 内容 |
|------|------|
| リポジトリ | Public 推奨（Private の場合はトークン権限に注意） |
| Actions | 有効（Settings → Actions → Allow） |
| Permissions | Workflow の `contents: write`（本リポジトリの YAML 済み） |
| Branch | `main` をデフォルトに |

### package.json / アプリ設定の一致

自動更新は **GitHub Releases の `latest.yml`** を読みます。  
`owner` / `repo` が間違っていると「GitHub 接続失敗」になります。

---

## Personal Access Token の設定

通常の公開リポジトリでは **Actions の `GITHUB_TOKEN` だけで Release 作成・アップロードが可能**です。

次の場合に **Personal Access Token (classic / fine-grained)** が必要です。

- 別アカウントのリポジトリへ Publish する
- Private リポジトリで electron-updater クライアントが認証付き取得する
- ローカルから `npm run dist:publish` で直接 Publish する

### classic PAT の作り方

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token**
3. スコープ例:
   - `repo`（Private 含む場合）
   - または Public のみなら `public_repo`
4. 生成されたトークンを安全に控える（再表示不可）

### fine-grained PAT の場合

- Repository access: 対象リポジトリ
- Permissions → Contents: **Read and write**
- Metadata: Read

---

## Secrets 登録方法

### A. GitHub Actions 用（推奨・通常は不要）

本ワークフローは `secrets.GITHUB_TOKEN` を使用します。  
追加 Secret は **基本不要** です。

別トークンを使う場合:

1. リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `GH_TOKEN`（または `RELEASE_TOKEN`）
4. Value: PAT
5. `release.yml` の `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` を  
   `${{ secrets.GH_TOKEN }}` に変更

### B. ローカル Publish 用

PowerShell:

```powershell
$env:GH_TOKEN = "ghp_xxxxxxxx"
npm run dist:publish
```

---

## GitHub Release の使い方

### 自動（推奨）

1. `package.json` の `version` を上げる（例: `1.0.1`）
2. `main` に Push
3. Actions「Release」が:
   - `npm install` / typecheck
   - `vite build` + `electron-builder`
   - GitHub Release 作成/更新
   - `Game Dev Assistant-<ver>-Setup.exe` と `latest.yml` をアップロード
4. クライアント起動時に electron-updater が `latest.yml` を確認

### 手動

1. Actions → **Release** → **Run workflow**
2. またはタグ:

```bash
npm version patch   # 1.0.0 → 1.0.1 + コミット
git push origin main --tags
```

### クライアント側の更新フロー

1. 起動時（`autoUpdate: true`）に確認
2. 「**新しいバージョンがあります**」バナー表示
3. ダウンロード
4. 「再起動してインストール」
5. 再起動後に新バージョンで起動

設定・DB・ログ・キャッシュは **userData に残る**ため消えません。

---

## 運用方法

### バージョンの上げ方

1. `package.json` → `"version": "x.y.z"`
2. `repository` / `publish.owner|repo` が正しいこと
3. `main` へ Push（または `vX.Y.Z` タグ）
4. Actions 成功を確認
5. Releases ページで Setup.exe を確認

### 更新チャネル

設定画面の **Update Channel**:

- `latest` … 安定版（通常運用）
- `beta` / `alpha` … プレリリース運用時

electron-builder / updater のチャネル名と Release の prerelease 設定を揃えてください。

### トラブルシュート

| 症状 | 確認 |
|------|------|
| 更新確認失敗 | Owner/Repo、ネットワーク、Release に `latest.yml` があるか |
| Actions 失敗 | electron のダウンロード、`signAndEditExecutable`、ログ |
| 起動しない | `release/win-unpacked` で直接 exe 確認 |
| 設定が消えた | 別 userData（別 appId）になっていないか |

ログ場所（Windows）:

```
%APPDATA%\game-dev-assistant\logs\app-YYYY-MM-DD.log
%APPDATA%\game-dev-assistant\gda.db
%APPDATA%\game-dev-assistant\data\
```

---

## ローカル開発・ビルド

```bash
npm install
npm run dev          # 開発（Vite + Electron）
npm run build        # レンダラ + メインのビルドのみ
npm run dist         # Setup.exe 生成（Publish なし）
npm run dist:publish # Setup.exe + GitHub Release 公開
npm run typecheck
npm run lint
```

### 完成条件チェックリスト

- [x] `npm install`
- [x] `npm run dev`
- [x] `npm run build`
- [x] `npm run dist` → `*-Setup.exe`
- [x] `.github/workflows/release.yml`
- [x] 起動時更新確認（パッケージ済み + autoUpdate）
- [x] 設定 / ログ / DB は userData に永続

---

## データ保持ポリシー

| データ | 場所 | アップデート後 |
|--------|------|----------------|
| 設定 | SQLite (`gda.db`) | 保持 |
| プロジェクト履歴 / Prompt / ログDB | SQLite | 保持 |
| ファイルログ | `userData/logs/` | 保持 |
| Assets | `userData/data/assets/` | 保持 |
| キャッシュ | `userData/cache/` | 保持 |
| プラグイン | `userData/plugins/` | 保持 |

NSIS の `deleteAppDataOnUninstall: false` のため、アンインストール時も userData は既定で残します。

---

## ライセンス

MIT

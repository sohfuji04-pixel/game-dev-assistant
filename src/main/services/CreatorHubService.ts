/**
 * 創作ツールハブ検出・起動サービス
 * ぽこぽこ creator-hub パターンを汎用化し、プロジェクト内ツールを一覧化する。
 */
import fs from 'node:fs';
import path from 'node:path';
import { shell } from 'electron';
import type { CreatorPipelineScript, CreatorTool, HubScanResult } from '../../shared/types';
import type { DevServerService } from './DevServerService';
import type { LogService } from './LogService';

/** ぽこぽこ向け既定ツール定義 */
const POKOPOKO_TOOLS: CreatorTool[] = [
  {
    id: 'board',
    kicker: 'Puzzle',
    title: 'パズル盤面作成',
    description: '形状・マスク・障害物を塗ってステージを作り、JSON 書き出しやすぐプレイ。',
    htmlPath: 'tools/board-editor.html',
    npmScript: 'workshop',
    tone: '#5ec4a8',
    chips: ['マスク編集', '障害物', 'npm run workshop'],
  },
  {
    id: 'audio',
    kicker: 'Audio',
    title: 'BGM / SE 作成',
    description: '手続き生成トラックの編集・試聴、WAV / OGG / MP3 書き出し。',
    htmlPath: 'audio-studio.html',
    npmScript: 'studio',
    tone: '#6ec8ff',
    chips: ['BGM優先', 'Export', 'npm run studio'],
  },
  {
    id: 'island',
    kicker: 'Island',
    title: '島作成',
    description: 'レイヤー合成・バイオーム建物・ホーム配置を編集し、PNG / JSON を出力。',
    htmlPath: 'island-studio.html',
    npmScript: 'island-studio',
    tone: '#3a8eb0',
    chips: ['3モード', 'PNG/JSON', 'npm run island-studio'],
  },
  {
    id: 'material',
    kicker: 'Material',
    title: 'マテリアル生成',
    description: '属性・農作物・特殊ピースのプレビュー、自動生成、画像取り込み。',
    htmlPath: 'tools/material-gen.html',
    npmScript: 'materials',
    tone: '#e09050',
    chips: ['自動生成', '画像取込', 'npm run materials'],
  },
  {
    id: 'char',
    kicker: 'Character',
    title: 'キャラクター作成',
    description: 'パーツ組立・手続生成・シート編集。シート取り込みで本編へ。',
    htmlPath: 'char-creator.html',
    npmScript: 'char:creator',
    tone: '#4f8f4a',
    chips: ['3方式', 'シート書出', 'npm run char:creator'],
  },
  {
    id: 'frame',
    kicker: 'Frame',
    title: 'フレーム・装飾作成',
    description: 'レイヤー分け・ランダム生成・画像取込で UI フレームと装飾を作る。',
    htmlPath: 'frame-creator.html',
    npmScript: 'frame:creator',
    tone: '#c48a4a',
    chips: ['レイヤー', '本編反映', 'npm run frame:creator'],
  },
];

const PIPELINE_CANDIDATES: CreatorPipelineScript[] = [
  { id: 'apply-audio', label: '音声を本編に適用', npmScript: 'apply:audio', description: 'Audio Studio の上書きを焼き込み' },
  { id: 'gen-audio', label: '音声を書き出し', npmScript: 'gen:audio', description: 'JSON → OGG/MP3 エクスポート' },
  { id: 'import-chars', label: 'キャラを取り込み', npmScript: 'import:chars', description: 'キャラシートを本編へ' },
  { id: 'import-frames', label: 'フレームを取り込み', npmScript: 'import:frames', description: 'フレームを本編へ' },
  { id: 'gen-materials', label: 'マテリアル生成', npmScript: 'gen:materials', description: 'ピース画像を生成' },
  { id: 'gen-materials-auto', label: 'マテリアル自動生成', npmScript: 'gen:materials:auto', description: '自動生成モード' },
  { id: 'hub', label: 'ハブサーバ起動 (npm)', npmScript: 'hub', description: 'npm run hub' },
];

export class CreatorHubService {
  constructor(
    private readonly devServer: DevServerService,
    private readonly log: LogService,
  ) {}

  /** プロジェクトをスキャンしてツール / パイプラインを返す */
  scan(projectRoot: string): HubScanResult {
    if (!projectRoot || !fs.existsSync(projectRoot)) {
      return {
        projectRoot,
        kind: 'none',
        hubHtml: null,
        tools: [],
        pipelines: [],
        packageScripts: [],
        gameIndex: null,
        previewPages: [],
      };
    }

    const pkg = this.readPackageScripts(projectRoot);
    const hasHub = fs.existsSync(path.join(projectRoot, 'creator-hub.html'));
    const tools = hasHub
      ? POKOPOKO_TOOLS.filter((t) => fs.existsSync(path.join(projectRoot, t.htmlPath)))
      : this.detectGenericTools(projectRoot, pkg);

    const pipelines = PIPELINE_CANDIDATES.filter((p) => pkg.includes(p.npmScript));
    const previewPages: Array<{ label: string; path: string }> = [];
    if (fs.existsSync(path.join(projectRoot, 'island-preview.html'))) {
      previewPages.push({ label: '島プレビュー', path: 'island-preview.html' });
    }
    const gameIndex = fs.existsSync(path.join(projectRoot, 'index.html')) ? 'index.html' : null;

    const kind = hasHub ? 'pokopoko' : tools.length > 0 ? 'generic' : pkg.length > 0 ? 'npm-only' : 'none';

    return {
      projectRoot,
      kind,
      hubHtml: hasHub ? 'creator-hub.html' : null,
      tools,
      pipelines,
      packageScripts: pkg,
      gameIndex,
      previewPages,
    };
  }

  async ensureServer(projectRoot: string, port = 8780) {
    const status = this.devServer.getStatus();
    if (status.running && status.root === projectRoot && status.baseUrl) {
      return status;
    }
    // アプリ内埋め込みのため内蔵サーバのみ使用（serve-local のブラウザ自動起動を避ける）
    return this.devServer.start(projectRoot, port, { preferScript: false });
  }

  /**
   * ツール URL を解決（アプリ内表示用。外部ブラウザは開かない）
   */
  async resolveToolUrl(
    projectRoot: string,
    htmlPath: string,
  ): Promise<{ success: boolean; url: string; message: string }> {
    const status = await this.ensureServer(projectRoot);
    if (!status.baseUrl) {
      return { success: false, url: '', message: '開発サーバを起動できませんでした' };
    }
    const normalized = htmlPath.replace(/\\/g, '/').replace(/^\//, '');
    const url = `${status.baseUrl}/${normalized}`;
    this.log.info('hub', `ツール URL 解決: ${normalized}`, url);
    return { success: true, url, message: `アプリ内で表示: ${normalized}` };
  }

  /** 互換: resolveToolUrl のエイリアス */
  async openTool(projectRoot: string, htmlPath: string) {
    return this.resolveToolUrl(projectRoot, htmlPath);
  }

  async openHub(projectRoot: string): Promise<{ success: boolean; url: string; message: string }> {
    const scan = this.scan(projectRoot);
    const page = scan.hubHtml ?? scan.gameIndex ?? 'index.html';
    return this.resolveToolUrl(projectRoot, page);
  }

  /** 必要時のみ外部ブラウザで開く */
  async openInExternalBrowser(url: string): Promise<void> {
    await shell.openExternal(url);
    this.log.info('hub', '外部ブラウザで開きました', url);
  }

  async stopServer() {
    return this.devServer.stop();
  }

  private readPackageScripts(projectRoot: string): string[] {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return [];
    try {
      const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
      return Object.keys(raw.scripts ?? {});
    } catch {
      return [];
    }
  }

  private detectGenericTools(projectRoot: string, scripts: string[]): CreatorTool[] {
    const candidates: Array<Omit<CreatorTool, 'id'> & { id: string; file: string }> = [
      { id: 'board', file: 'tools/board-editor.html', kicker: 'Puzzle', title: '盤面エディタ', description: 'ステージ編集', htmlPath: 'tools/board-editor.html', npmScript: 'workshop', tone: '#5ec4a8', chips: [] },
      { id: 'audio', file: 'audio-studio.html', kicker: 'Audio', title: 'Audio Studio', description: 'BGM / SE', htmlPath: 'audio-studio.html', npmScript: 'studio', tone: '#6ec8ff', chips: [] },
      { id: 'island', file: 'island-studio.html', kicker: 'Island', title: '島スタジオ', description: '島編集', htmlPath: 'island-studio.html', npmScript: 'island-studio', tone: '#3a8eb0', chips: [] },
      { id: 'material', file: 'tools/material-gen.html', kicker: 'Material', title: 'マテリアル', description: '素材生成', htmlPath: 'tools/material-gen.html', npmScript: 'materials', tone: '#e09050', chips: [] },
      { id: 'char', file: 'char-creator.html', kicker: 'Character', title: 'キャラ作成', description: 'キャラクター', htmlPath: 'char-creator.html', npmScript: 'char:creator', tone: '#4f8f4a', chips: [] },
      { id: 'frame', file: 'frame-creator.html', kicker: 'Frame', title: 'フレーム作成', description: 'UI フレーム', htmlPath: 'frame-creator.html', npmScript: 'frame:creator', tone: '#c48a4a', chips: [] },
    ];

    return candidates
      .filter((c) => fs.existsSync(path.join(projectRoot, c.file)))
      .map((c) => ({
        id: c.id,
        kicker: c.kicker,
        title: c.title,
        description: c.description,
        htmlPath: c.htmlPath,
        npmScript: scripts.includes(c.npmScript ?? '') ? c.npmScript : undefined,
        tone: c.tone,
        chips: c.npmScript && scripts.includes(c.npmScript) ? [`npm run ${c.npmScript}`] : [],
      }));
  }
}

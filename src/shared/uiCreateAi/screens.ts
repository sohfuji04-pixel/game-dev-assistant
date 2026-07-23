/**
 * UI 画面テンプレート
 * 新しい画面はこの配列に追加するだけで拡張できる。
 */
import type { UiScreenDefinition, UiScreenId } from '../types/uiCreateAi';

export const UI_SCREENS: UiScreenDefinition[] = [
  {
    id: 'home',
    label: 'ホーム画面',
    description: 'タイトル・メイン導線・下部メニューを持つ入口',
    typicalComponents: ['Header', 'Footer', 'Button', 'Icon', 'Badge', 'Notification'],
    typicalIcons: ['icon_home', 'icon_shop', 'icon_gacha', 'icon_event', 'icon_setting', 'icon_mail'],
  },
  {
    id: 'shop',
    label: 'ショップ画面',
    description: '商品一覧・タブ・購入確認',
    typicalComponents: ['Tab', 'ScrollView', 'Panel', 'Button', 'Badge', 'Dialog'],
    typicalIcons: ['icon_coin', 'icon_gem', 'icon_cart', 'icon_close', 'icon_sale'],
  },
  {
    id: 'gacha',
    label: 'ガチャ画面',
    description: '演出・排出・結果遷移を意識した抽選 UI',
    typicalComponents: ['Button', 'Panel', 'Popup', 'Loading', 'ParticleHost'],
    typicalIcons: ['icon_ticket', 'icon_skip', 'icon_rate', 'icon_history'],
  },
  {
    id: 'settings',
    label: '設定画面',
    description: 'トグル・スライダー・アカウント操作',
    typicalComponents: ['ScrollView', 'Toggle', 'Slider', 'Button', 'Dialog'],
    typicalIcons: ['icon_sound', 'icon_bgm', 'icon_language', 'icon_account', 'icon_back'],
  },
  {
    id: 'encyclopedia',
    label: '図鑑画面',
    description: 'グリッド一覧・詳細・収集進捗',
    typicalComponents: ['ScrollView', 'Grid', 'Panel', 'ProgressBar', 'Popup'],
    typicalIcons: ['icon_lock', 'icon_star', 'icon_filter', 'icon_search'],
  },
  {
    id: 'event',
    label: 'イベント画面',
    description: '期間・報酬・参加導線',
    typicalComponents: ['Header', 'Banner', 'Button', 'Timer', 'Panel'],
    typicalIcons: ['icon_event', 'icon_reward', 'icon_calendar', 'icon_share'],
  },
  {
    id: 'ranking',
    label: 'ランキング画面',
    description: '順位リスト・自分の位置・期間切替',
    typicalComponents: ['Tab', 'ScrollView', 'ListItem', 'Avatar', 'Badge'],
    typicalIcons: ['icon_rank1', 'icon_rank2', 'icon_rank3', 'icon_me', 'icon_trophy'],
  },
  {
    id: 'result',
    label: 'リザルト画面',
    description: 'スコア・報酬・再挑戦',
    typicalComponents: ['Panel', 'Button', 'Badge', 'ParticleHost'],
    typicalIcons: ['icon_retry', 'icon_home', 'icon_share', 'icon_reward'],
  },
  {
    id: 'mission',
    label: 'ミッション画面',
    description: '日次/実績タスクと報酬受け取り',
    typicalComponents: ['Tab', 'ScrollView', 'ProgressBar', 'Button', 'Badge'],
    typicalIcons: ['icon_check', 'icon_gift', 'icon_daily', 'icon_lock'],
  },
  {
    id: 'friend',
    label: 'フレンド画面',
    description: '一覧・申請・ギフト',
    typicalComponents: ['Tab', 'ScrollView', 'ListItem', 'Button', 'Dialog'],
    typicalIcons: ['icon_friend', 'icon_gift', 'icon_add', 'icon_search'],
  },
];

export function getScreenById(id: string): UiScreenDefinition | undefined {
  return UI_SCREENS.find((s) => s.id === id);
}

const SCREEN_ALIASES: Array<{ id: Exclude<UiScreenId, 'custom'>; patterns: RegExp[] }> = [
  { id: 'home', patterns: [/ホーム|home|タイトル|title|メイン/i] },
  { id: 'shop', patterns: [/ショップ|shop|商店|ストア|store/i] },
  { id: 'gacha', patterns: [/ガチャ|gacha|抽選|召喚/i] },
  { id: 'settings', patterns: [/設定|settings?|オプション/i] },
  { id: 'encyclopedia', patterns: [/図鑑|encyclopedia|コレクション/i] },
  { id: 'event', patterns: [/イベント|event/i] },
  { id: 'ranking', patterns: [/ランキング|ranking|順位/i] },
  { id: 'result', patterns: [/リザルト|result|結果/i] },
  { id: 'mission', patterns: [/ミッション|mission|クエスト|quest/i] },
  { id: 'friend', patterns: [/フレンド|friend|友達/i] },
];

export function detectScreenFromText(text: string): UiScreenDefinition {
  for (const alias of SCREEN_ALIASES) {
    if (alias.patterns.some((p) => p.test(text))) {
      return getScreenById(alias.id)!;
    }
  }
  return getScreenById('home')!;
}

/** ジャンル推定（表示用ラベル） */
export function detectGenreLabel(text: string): string {
  const lower = text.toLowerCase();
  const rules: Array<{ label: string; re: RegExp }> = [
    { label: 'かわいい牧場ゲーム', re: /牧場|farm/i },
    { label: 'ファンタジーRPG', re: /ファンタジー|fantasy|rpg/i },
    { label: 'パズル', re: /パズル|puzzle/i },
    { label: '放置ゲーム', re: /放置|idle/i },
    { label: 'シミュレーション', re: /シミュレーション|simulation|sim/i },
    { label: 'アクション', re: /アクション|action/i },
    { label: 'カジュアル', re: /カジュアル|casual/i },
    { label: 'SF', re: /\bsf\b|sci-?fi|近未来|宇宙/i },
    { label: '和風', re: /和風|和風|japanese/i },
    { label: 'ダーク', re: /ダーク|dark|ホラー/i },
    { label: 'ポップ', re: /ポップ|pop/i },
  ];
  const hits = rules.filter((r) => r.re.test(lower)).map((r) => r.label);
  if (hits.length === 0) return 'カジュアルゲーム';
  return [...new Set(hits)].join(' / ');
}

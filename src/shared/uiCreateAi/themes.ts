/**
 * UI テーマテンプレート
 * 新しいテーマはこの配列に追加するだけで拡張できる。
 */
import type { UiThemeDefinition } from '../types/uiCreateAi';

export const UI_THEMES: UiThemeDefinition[] = [
  {
    id: 'cute',
    label: 'かわいい',
    description: '丸み・パステル・親しみやすさ重視',
    keywords: ['かわいい', '可愛い', 'cute', 'パステル', 'ゆるい'],
    palette: {
      primary: '#FF8FAB',
      secondary: '#FFC2D1',
      accent: '#A2D2FF',
      background: '#FFF7FB',
      text: '#5C4B5C',
      warning: '#FFB703',
      success: '#8AC926',
    },
    fontHints: ['Rounded Mplus 1c', 'Nunito', 'M PLUS Rounded 1c'],
  },
  {
    id: 'fantasy',
    label: 'ファンタジー',
    description: '魔法・紋章・ゴールドアクセント',
    keywords: ['ファンタジー', 'fantasy', '魔法', 'RPG', '中世'],
    palette: {
      primary: '#6B4EFF',
      secondary: '#9B7BFF',
      accent: '#E8B84A',
      background: '#1A1430',
      text: '#F4EEFF',
      warning: '#FF9F1C',
      success: '#2EC4B6',
    },
    fontHints: ['Cinzel', 'Shippori Mincho', 'Trajan Pro'],
  },
  {
    id: 'japanese',
    label: '和風',
    description: '余白・筆致・伝統色',
    keywords: ['和風', '和', 'japanese', '着物', '侍', '神社'],
    palette: {
      primary: '#C23A2B',
      secondary: '#2F5D50',
      accent: '#D4A017',
      background: '#F7F1E3',
      text: '#2B2118',
      warning: '#B85C38',
      success: '#3E7C59',
    },
    fontHints: ['Shippori Mincho', 'Noto Serif JP', 'Sawarabi Mincho'],
  },
  {
    id: 'sf',
    label: 'SF',
    description: 'ネオン・HUD・近未来 UI',
    keywords: ['SF', 'sci-fi', '近未来', 'サイバー', '宇宙'],
    palette: {
      primary: '#00E5FF',
      secondary: '#7B61FF',
      accent: '#FF2E63',
      background: '#0A0F1C',
      text: '#E6F7FF',
      warning: '#FFC857',
      success: '#3DFFB5',
    },
    fontHints: ['Orbitron', 'Rajdhani', 'Share Tech Mono'],
  },
  {
    id: 'pop',
    label: 'ポップ',
    description: '高彩度・大胆なシェイプ',
    keywords: ['ポップ', 'pop', '派手', 'カジュアル', '明るい'],
    palette: {
      primary: '#FF5C8A',
      secondary: '#FFD166',
      accent: '#06D6A0',
      background: '#FFF9F0',
      text: '#2D3142',
      warning: '#F77F00',
      success: '#06D6A0',
    },
    fontHints: ['Baloo 2', 'Fredoka', 'M PLUS Rounded 1c'],
  },
  {
    id: 'dark',
    label: 'ダーク',
    description: '低彩度・緊張感・視認性重視',
    keywords: ['ダーク', 'dark', 'ホラー', 'シリアス', '闇'],
    palette: {
      primary: '#8B5CF6',
      secondary: '#4B5563',
      accent: '#F43F5E',
      background: '#0B0D12',
      text: '#E5E7EB',
      warning: '#F59E0B',
      success: '#10B981',
    },
    fontHints: ['Inter', 'Noto Sans JP', 'IBM Plex Sans'],
  },
  {
    id: 'nordic',
    label: '北欧',
    description: 'ミニマル・自然色・余白多め',
    keywords: ['北欧', 'nordic', 'ミニマル', '自然', '落ち着き'],
    palette: {
      primary: '#4A6FA5',
      secondary: '#A3B18A',
      accent: '#BC6C25',
      background: '#F5F3EF',
      text: '#2F3E46',
      warning: '#C9A227',
      success: '#588157',
    },
    fontHints: ['DM Sans', 'Source Sans 3', 'Noto Sans JP'],
  },
  {
    id: 'nintendo',
    label: '任天堂風',
    description: '親しみやすい・明快・誰でも使える',
    keywords: ['任天堂', 'nintendo', 'ファミリー', 'わかりやすい'],
    palette: {
      primary: '#E60012',
      secondary: '#1B9FFF',
      accent: '#FFCC00',
      background: '#F2F6FA',
      text: '#1A1A1A',
      warning: '#FF8A00',
      success: '#34C759',
    },
    fontHints: ['Nunito', 'Rounded Mplus 1c', 'Varela Round'],
  },
  {
    id: 'picturebook',
    label: '絵本風',
    description: '手描き感・やわらかい輪郭・物語性',
    keywords: ['絵本', 'picture', '物語', '子供', '温かい'],
    palette: {
      primary: '#E07A5F',
      secondary: '#81B29A',
      accent: '#F2CC8F',
      background: '#F4F1DE',
      text: '#3D405B',
      warning: '#E9C46A',
      success: '#81B29A',
    },
    fontHints: ['Comic Neue', 'Kiwi Maru', 'Yomogi'],
  },
  {
    id: 'luxury',
    label: '高級感',
    description: '金・深い黒・余白とタイポグラフィ',
    keywords: ['高級', 'luxury', 'プレミアム', '上品', 'リッチ'],
    palette: {
      primary: '#C9A962',
      secondary: '#8A7A5C',
      accent: '#E8D5A3',
      background: '#12100E',
      text: '#F5F0E6',
      warning: '#D4A373',
      success: '#A3B18A',
    },
    fontHints: ['Playfair Display', 'Cormorant Garamond', 'Noto Serif JP'],
  },
];

export function getThemeById(id: string): UiThemeDefinition | undefined {
  return UI_THEMES.find((t) => t.id === id);
}

/** 入力テキストからテーマを推定 */
export function detectThemeFromText(text: string): UiThemeDefinition {
  const lower = text.toLowerCase();
  let best = UI_THEMES[0];
  let bestScore = 0;
  for (const theme of UI_THEMES) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (lower.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = theme;
    }
  }
  // キーワード未ヒット時はジャンルっぽい語でフォールバック
  if (bestScore === 0) {
    if (/牧場|farm|癒し|healing/.test(lower)) return getThemeById('cute')!;
    if (/rpg|冒険|ダンジョン/.test(lower)) return getThemeById('fantasy')!;
    if (/放置|idle|シミュレーション|simulation/.test(lower)) return getThemeById('pop')!;
    if (/アクション|action|バトル/.test(lower)) return getThemeById('dark')!;
    if (/パズル|puzzle|カジュアル/.test(lower)) return getThemeById('nintendo')!;
    return getThemeById('cute')!;
  }
  return best;
}

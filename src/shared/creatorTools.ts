/**
 * 創作ツール（Creator Hub）のナビ／識別子
 * サイドバー AI/3D とハブで共有する
 */
export interface CreatorToolNavItem {
  id: string;
  label: string;
  kicker: string;
}

/** 青枠の 6 ツール（ぽこぽこ Creator Hub） */
export const CREATOR_TOOL_NAV: CreatorToolNavItem[] = [
  { id: 'board', label: 'パズル盤面', kicker: 'Puzzle' },
  { id: 'audio', label: 'BGM / SE', kicker: 'Audio' },
  { id: 'island', label: '島作成', kicker: 'Island' },
  { id: 'material', label: 'マテリアル', kicker: 'Material' },
  { id: 'char', label: 'キャラクター', kicker: 'Character' },
  { id: 'frame', label: 'フレーム', kicker: 'Frame' },
];

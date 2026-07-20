/**
 * ゲーム向けテンプレート定義
 * UI・AI・Blender Python 側で同じ ID を参照する
 */
export interface GameTemplate {
  id: string;
  label: string;
  description: string;
  category: 'character' | 'animal' | 'nature' | 'world' | 'prop' | 'lighting' | 'export';
  /** Blender 側 template.run に渡すキー */
  blenderKey: string;
  /** AI が認識する日本語フレーズ例 */
  phrases: string[];
}

export const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: 'farm_girl',
    label: '可愛い牧場少女を作成',
    description: '二頭身の可愛い牧場少女キャラクターを生成',
    category: 'character',
    blenderKey: 'farm_girl',
    phrases: ['可愛い牧場少女を作成', '牧場少女', '二頭身の少女'],
  },
  {
    id: 'cute_sheep',
    label: '可愛い羊を作成',
    description: '低ポリの可愛い羊モデルを生成',
    category: 'animal',
    blenderKey: 'cute_sheep',
    phrases: ['可愛い羊を作成', '羊を作成'],
  },
  {
    id: 'cow',
    label: '牛を作成',
    description: '牧場向けの牛モデルを生成',
    category: 'animal',
    blenderKey: 'cow',
    phrases: ['牛を作成'],
  },
  {
    id: 'chicken',
    label: '鶏を作成',
    description: '牧場向けの鶏モデルを生成',
    category: 'animal',
    blenderKey: 'chicken',
    phrases: ['鶏を作成'],
  },
  {
    id: 'tree',
    label: '木を作成',
    description: '樹木を生成',
    category: 'nature',
    blenderKey: 'tree',
    phrases: ['木を作成', '木をもっと太く'],
  },
  {
    id: 'world_tree',
    label: '世界樹を作成',
    description: '巨大な世界樹を生成',
    category: 'nature',
    blenderKey: 'world_tree',
    phrases: ['世界樹を作成'],
  },
  {
    id: 'crystal',
    label: 'クリスタルを作成',
    description: '発光するクリスタルを生成',
    category: 'prop',
    blenderKey: 'crystal',
    phrases: ['クリスタルを作成'],
  },
  {
    id: 'farm',
    label: '牧場を作成',
    description: '牧場シーン一式を生成',
    category: 'world',
    blenderKey: 'farm',
    phrases: ['牧場を作成'],
  },
  {
    id: 'island',
    label: '島を作成',
    description: '浮島／島地形を生成',
    category: 'world',
    blenderKey: 'island',
    phrases: ['島を作成'],
  },
  {
    id: 'puzzle_piece',
    label: 'パズルピースを作成',
    description: 'パズルピース形状を生成',
    category: 'prop',
    blenderKey: 'puzzle_piece',
    phrases: ['パズルピースを作成'],
  },
  {
    id: 'place_flowers',
    label: '花を配置',
    description: '花をシーンに配置',
    category: 'nature',
    blenderKey: 'place_flowers',
    phrases: ['花を配置'],
  },
  {
    id: 'scatter_grass',
    label: '草をランダム配置',
    description: '草をランダムに散布',
    category: 'nature',
    blenderKey: 'scatter_grass',
    phrases: ['草をランダム配置', '草を配置'],
  },
  {
    id: 'place_rocks',
    label: '岩を配置',
    description: '岩をシーンに配置',
    category: 'nature',
    blenderKey: 'place_rocks',
    phrases: ['岩を配置'],
  },
  {
    id: 'daylight',
    label: '昼に変更',
    description: 'ワールドを昼間のライティングに変更',
    category: 'lighting',
    blenderKey: 'daylight',
    phrases: ['昼に変更', '昼にする'],
  },
  {
    id: 'sunset',
    label: '夕焼けに変更',
    description: 'ワールドを夕焼けライティングに変更',
    category: 'lighting',
    blenderKey: 'sunset',
    phrases: ['夕焼けに変更', '夕方にする'],
  },
  {
    id: 'export_fbx',
    label: 'FBXを書き出し',
    description: '選択またはシーンを FBX で書き出し',
    category: 'export',
    blenderKey: 'export_fbx',
    phrases: ['FBXを書き出し', 'FBXで書き出す'],
  },
  {
    id: 'export_gltf',
    label: 'glTFを書き出し',
    description: '選択またはシーンを glTF で書き出し',
    category: 'export',
    blenderKey: 'export_gltf',
    phrases: ['glTFを書き出し', 'gltfで書き出す'],
  },
];

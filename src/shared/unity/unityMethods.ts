/**
 * Unity Editor Bridge RPC メソッド名
 */
export const UnityRpcMethods = {
  ping: 'system.ping',
  getState: 'editor.getState',
  saveProject: 'project.save',
  addPackage: 'package.add',
  newScene: 'scene.new',
  saveScene: 'scene.save',
  openScene: 'scene.open',
  createGameObject: 'hierarchy.create',
  deleteGameObject: 'hierarchy.delete',
  renameGameObject: 'hierarchy.rename',
  findGameObject: 'hierarchy.find',
  duplicateGameObject: 'hierarchy.duplicate',
  setParent: 'hierarchy.setParent',
  addComponent: 'component.add',
  removeComponent: 'component.remove',
  createPrefab: 'asset.createPrefab',
  createMaterial: 'asset.createMaterial',
  createAnimatorController: 'asset.createAnimatorController',
  generateMenuUi: 'ui.generateMenu',
  buildPlayer: 'build.player',
  getConsole: 'console.getEntries',
} as const;

/** UI クイックコマンド */
export const UNITY_QUICK_COMMANDS = [
  {
    id: 'player',
    label: 'プレイヤーを追加',
    description: 'Capsule + Rigidbody のプレイヤー',
    phrase: 'プレイヤーを追加',
  },
  {
    id: 'enemies',
    label: '敵を10体生成',
    description: 'Cube 敵を複数生成',
    phrase: '敵を10体生成',
  },
  {
    id: 'menu',
    label: 'タイトル画面を作成',
    description: 'メニュー UI 自動生成',
    phrase: 'タイトル画面を作成',
  },
  {
    id: 'save_scene',
    label: 'シーンを保存',
    description: 'アクティブシーンを保存',
    phrase: 'シーンを保存',
  },
  {
    id: 'prefab',
    label: 'Prefab を作成',
    description: '選択オブジェクトから Prefab',
    phrase: 'プレハブを作成',
  },
  {
    id: 'animator',
    label: 'Animator を作成',
    description: 'Animator Controller 生成',
    phrase: 'Animatorを作成',
  },
  {
    id: 'canvas',
    label: 'Canvas を追加',
    description: 'UI Canvas コンポーネント',
    phrase: 'Canvasを追加',
  },
  {
    id: 'build_win',
    label: 'Windows ビルド',
    description: '危険操作・要確認相当',
    phrase: 'Windowsビルド',
  },
] as const;

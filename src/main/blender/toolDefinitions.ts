import { BlenderMethods } from '@shared/blender/blenderMethods';
import { GAME_TEMPLATES } from '@shared/blender/templates';

/** Optional plugin host (PluginHost not bundled; duck-typed). */
export interface BlenderToolPluginHost {
  listTools(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown> | { properties?: Record<string, unknown> };
  }>;
}

/**
 * OpenAI Function Calling / MCP 共有のツール定義
 */
export function buildOpenAITools(plugins?: BlenderToolPluginHost) {
  const base = [
    tool(BlenderMethods.objectAddCube, '立方体を追加', {
      name: { type: 'string' },
      location: { type: 'array', items: { type: 'number' } },
      size: { type: 'number' },
    }),
    tool(BlenderMethods.objectAddSphere, '球を追加', {
      name: { type: 'string' },
      location: { type: 'array', items: { type: 'number' } },
      size: { type: 'number' },
    }),
    tool(BlenderMethods.objectAddPlane, '平面を追加', {
      name: { type: 'string' },
      location: { type: 'array', items: { type: 'number' } },
      size: { type: 'number' },
    }),
    tool(BlenderMethods.objectDelete, '選択または指定オブジェクトを削除', {
      names: { type: 'array', items: { type: 'string' } },
    }),
    tool(BlenderMethods.objectTranslate, 'オブジェクトを移動', {
      names: { type: 'array', items: { type: 'string' } },
      value: { type: 'array', items: { type: 'number' } },
    }),
    tool(BlenderMethods.objectRotate, 'オブジェクトを回転（度数）', {
      names: { type: 'array', items: { type: 'string' } },
      value: { type: 'array', items: { type: 'number' } },
    }),
    tool(BlenderMethods.objectScale, 'オブジェクトを拡大縮小', {
      names: { type: 'array', items: { type: 'string' } },
      value: { type: 'array', items: { type: 'number' } },
    }),
    tool(BlenderMethods.objectRename, '名前変更', {
      name: { type: 'string' },
      new_name: { type: 'string' },
    }),
    tool(BlenderMethods.modifierAdd, 'Modifier追加', {
      object: { type: 'string' },
      type: {
        type: 'string',
        description: 'subdivision|mirror|boolean|solidify|bevel|array|decimate|remesh',
      },
      levels: { type: 'number' },
      properties: { type: 'object' },
    }),
    tool(BlenderMethods.materialCreate, 'マテリアル作成', {
      name: { type: 'string' },
      base_color: { type: 'array', items: { type: 'number' } },
      metallic: { type: 'number' },
      roughness: { type: 'number' },
    }),
    tool(BlenderMethods.materialAssign, 'マテリアル割当', {
      object: { type: 'string' },
      material: { type: 'string' },
    }),
    tool(BlenderMethods.worldSetTimeOfDay, '昼夜・夕焼け変更', {
      mode: { type: 'string', description: 'day|sunset|night' },
    }),
    tool(BlenderMethods.exportFbx, 'FBX書き出し', {
      path: { type: 'string' },
      selected_only: { type: 'boolean' },
    }),
    tool(BlenderMethods.exportGltf, 'glTF書き出し', {
      path: { type: 'string' },
      selected_only: { type: 'boolean' },
      format: { type: 'string' },
    }),
    tool(BlenderMethods.animAddClip, 'アニメーションクリップ追加', {
      name: { type: 'string', description: 'Idle|Walk|Run|Jump|Attack|Harvest|Fishing|Wave' },
      object: { type: 'string' },
    }),
    tool(BlenderMethods.armatureCreate, 'アーマチュア生成', {
      name: { type: 'string' },
    }),
    tool(BlenderMethods.templateRun, 'ゲーム向けテンプレート実行', {
      key: {
        type: 'string',
        description: GAME_TEMPLATES.map((t) => t.blenderKey).join('|'),
      },
      path: { type: 'string', description: 'エクスポート時のパス' },
    }),
    tool(BlenderMethods.undo, 'Undo', {}),
    tool(BlenderMethods.redo, 'Redo', {}),
  ];

  const pluginTools =
    plugins?.listTools().map((t) =>
      tool(t.name, t.description, (t.parameters as { properties?: Record<string, unknown> }).properties ?? t.parameters),
    ) ?? [];

  return [...base, ...pluginTools];
}

function tool(name: string, description: string, properties: Record<string, unknown>) {
  return {
    type: 'function' as const,
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        additionalProperties: true,
      },
    },
  };
}

/** MCP 向け JSON Schema カタログ */
export function listMcpToolSchemas() {
  return buildOpenAITools().map((t) => ({
    name: t.function.name,
    description: t.function.description,
    inputSchema: t.function.parameters,
  }));
}

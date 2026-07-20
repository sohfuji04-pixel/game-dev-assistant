/**
 * Blender 操作メソッド名の定数
 * Function Calling / MCP Tool と共有する単一の真実源
 */
export const BlenderMethods = {
  // Connection / meta
  ping: 'system.ping',
  version: 'system.version',
  undo: 'system.undo',
  redo: 'system.redo',

  // Object primitives
  objectAddCube: 'object.add_cube',
  objectAddSphere: 'object.add_sphere',
  objectAddPlane: 'object.add_plane',
  objectDelete: 'object.delete',
  objectDuplicate: 'object.duplicate',
  objectRotate: 'object.rotate',
  objectTranslate: 'object.translate',
  objectScale: 'object.scale',
  objectSetOrigin: 'object.set_origin',
  objectRename: 'object.rename',
  objectSetParent: 'object.set_parent',
  collectionCreate: 'collection.create',

  // Modifiers
  modifierAdd: 'modifier.add',
  modifierApply: 'modifier.apply',

  // Material
  materialCreate: 'material.create',
  materialAssign: 'material.assign',
  materialSetProperty: 'material.set_property',
  materialDelete: 'material.delete',
  worldSetHdri: 'world.set_hdri',

  // UV
  uvSmartProject: 'uv.smart_project',
  uvUnwrap: 'uv.unwrap',
  uvPack: 'uv.pack',

  // Mesh edit
  meshExtrude: 'mesh.extrude',
  meshInset: 'mesh.inset',
  meshBevel: 'mesh.bevel',
  meshLoopCut: 'mesh.loop_cut',
  meshMerge: 'mesh.merge',
  meshSeparate: 'mesh.separate',
  meshJoin: 'mesh.join',
  meshRemesh: 'mesh.remesh',
  meshDecimate: 'mesh.decimate',

  // Character / templates
  characterCreateChibi: 'character.create_chibi',
  templateRun: 'template.run',

  // Rig
  armatureCreate: 'armature.create',
  armatureAddBone: 'armature.add_bone',
  armatureAutoWeight: 'armature.auto_weight',
  armatureAddIk: 'armature.add_ik',

  // Animation
  animAddClip: 'anim.add_clip',
  animKeyframe: 'anim.keyframe',

  // World / camera / light / render
  worldSetTimeOfDay: 'world.set_time_of_day',
  cameraAdd: 'camera.add',
  lightAdd: 'light.add',
  renderSetEngine: 'render.set_engine',
  renderStill: 'render.still',
  renderAnimation: 'render.animation',

  // Export
  exportBlend: 'export.blend',
  exportFbx: 'export.fbx',
  exportObj: 'export.obj',
  exportGltf: 'export.gltf',
  exportStl: 'export.stl',
  exportAlembic: 'export.alembic',
  exportUsd: 'export.usd',
} as const;

export type BlenderMethod = (typeof BlenderMethods)[keyof typeof BlenderMethods];

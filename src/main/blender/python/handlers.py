"""
JSON-RPC メソッドディスパッチャ
各 handler は Blender メインスレッドから呼ばれる前提
"""

from __future__ import annotations

from typing import Any, Callable, Dict

import bpy

from . import materials, mesh_ops, modifiers, objects, render_export, templates, world_ops

Handler = Callable[[Dict[str, Any]], Any]

_REGISTRY: Dict[str, Handler] = {}


def method(name: str):
    def deco(fn: Handler):
        _REGISTRY[name] = fn
        return fn

    return deco


def dispatch(name: str, params: Dict[str, Any]) -> Any:
    if name not in _REGISTRY:
        raise ValueError(f"Unknown method: {name}")
    return _REGISTRY[name](params)


@method("system.ping")
def system_ping(_params: Dict[str, Any]) -> Dict[str, Any]:
    return {"ok": True}


@method("system.version")
def system_version(_params: Dict[str, Any]) -> Dict[str, Any]:
    return {"version": bpy.app.version_string, "blender": list(bpy.app.version)}


@method("system.undo")
def system_undo(_params: Dict[str, Any]) -> Dict[str, Any]:
    bpy.ops.ed.undo()
    return {"ok": True}


@method("system.redo")
def system_redo(_params: Dict[str, Any]) -> Dict[str, Any]:
    bpy.ops.ed.redo()
    return {"ok": True}


# ---- objects ----
@method("object.add_cube")
def object_add_cube(p: Dict[str, Any]):
    return objects.add_primitive("cube", p)


@method("object.add_sphere")
def object_add_sphere(p: Dict[str, Any]):
    return objects.add_primitive("sphere", p)


@method("object.add_plane")
def object_add_plane(p: Dict[str, Any]):
    return objects.add_primitive("plane", p)


@method("object.delete")
def object_delete(p: Dict[str, Any]):
    return objects.delete_objects(p)


@method("object.duplicate")
def object_duplicate(p: Dict[str, Any]):
    return objects.duplicate(p)


@method("object.rotate")
def object_rotate(p: Dict[str, Any]):
    return objects.transform(p, "rotate")


@method("object.translate")
def object_translate(p: Dict[str, Any]):
    return objects.transform(p, "translate")


@method("object.scale")
def object_scale(p: Dict[str, Any]):
    return objects.transform(p, "scale")


@method("object.set_origin")
def object_set_origin(p: Dict[str, Any]):
    return objects.set_origin(p)


@method("object.rename")
def object_rename(p: Dict[str, Any]):
    return objects.rename(p)


@method("object.set_parent")
def object_set_parent(p: Dict[str, Any]):
    return objects.set_parent(p)


@method("collection.create")
def collection_create(p: Dict[str, Any]):
    return objects.create_collection(p)


# ---- modifiers ----
@method("modifier.add")
def modifier_add(p: Dict[str, Any]):
    return modifiers.add_modifier(p)


@method("modifier.apply")
def modifier_apply(p: Dict[str, Any]):
    return modifiers.apply_modifier(p)


# ---- materials / world ----
@method("material.create")
def material_create(p: Dict[str, Any]):
    return materials.create_material(p)


@method("material.assign")
def material_assign(p: Dict[str, Any]):
    return materials.assign_material(p)


@method("material.set_property")
def material_set_property(p: Dict[str, Any]):
    return materials.set_property(p)


@method("material.delete")
def material_delete(p: Dict[str, Any]):
    return materials.delete_material(p)


@method("world.set_hdri")
def world_set_hdri(p: Dict[str, Any]):
    return world_ops.set_hdri(p)


@method("world.set_time_of_day")
def world_set_time(p: Dict[str, Any]):
    return world_ops.set_time_of_day(p)


# ---- UV / mesh ----
@method("uv.smart_project")
def uv_smart(p: Dict[str, Any]):
    return mesh_ops.uv_smart_project(p)


@method("uv.unwrap")
def uv_unwrap(p: Dict[str, Any]):
    return mesh_ops.uv_unwrap(p)


@method("uv.pack")
def uv_pack(p: Dict[str, Any]):
    return mesh_ops.uv_pack(p)


@method("mesh.extrude")
def mesh_extrude(p: Dict[str, Any]):
    return mesh_ops.extrude(p)


@method("mesh.inset")
def mesh_inset(p: Dict[str, Any]):
    return mesh_ops.inset(p)


@method("mesh.bevel")
def mesh_bevel(p: Dict[str, Any]):
    return mesh_ops.bevel(p)


@method("mesh.loop_cut")
def mesh_loop_cut(p: Dict[str, Any]):
    return mesh_ops.loop_cut(p)


@method("mesh.merge")
def mesh_merge(p: Dict[str, Any]):
    return mesh_ops.merge(p)


@method("mesh.separate")
def mesh_separate(p: Dict[str, Any]):
    return mesh_ops.separate(p)


@method("mesh.join")
def mesh_join(p: Dict[str, Any]):
    return mesh_ops.join(p)


@method("mesh.remesh")
def mesh_remesh(p: Dict[str, Any]):
    return mesh_ops.remesh(p)


@method("mesh.decimate")
def mesh_decimate(p: Dict[str, Any]):
    return mesh_ops.decimate(p)


# ---- character / templates ----
@method("character.create_chibi")
def character_chibi(p: Dict[str, Any]):
    return templates.create_chibi(p)


@method("template.run")
def template_run(p: Dict[str, Any]):
    return templates.run_template(p)


# ---- armature / anim (minimal) ----
@method("armature.create")
def armature_create(p: Dict[str, Any]):
    return templates.create_armature(p)


@method("armature.add_bone")
def armature_add_bone(p: Dict[str, Any]):
    return templates.add_bone(p)


@method("armature.auto_weight")
def armature_auto_weight(p: Dict[str, Any]):
    return templates.auto_weight(p)


@method("armature.add_ik")
def armature_add_ik(p: Dict[str, Any]):
    return templates.add_ik(p)


@method("anim.add_clip")
def anim_add_clip(p: Dict[str, Any]):
    return templates.add_anim_clip(p)


@method("anim.keyframe")
def anim_keyframe(p: Dict[str, Any]):
    return templates.insert_keyframe(p)


# ---- camera / light / render / export ----
@method("camera.add")
def camera_add(p: Dict[str, Any]):
    return world_ops.add_camera(p)


@method("light.add")
def light_add(p: Dict[str, Any]):
    return world_ops.add_light(p)


@method("render.set_engine")
def render_set_engine(p: Dict[str, Any]):
    return render_export.set_engine(p)


@method("render.still")
def render_still(p: Dict[str, Any]):
    return render_export.render_still(p)


@method("render.animation")
def render_animation(p: Dict[str, Any]):
    return render_export.render_animation(p)


@method("export.blend")
def export_blend(p: Dict[str, Any]):
    return render_export.export_blend(p)


@method("export.fbx")
def export_fbx(p: Dict[str, Any]):
    return render_export.export_fbx(p)


@method("export.obj")
def export_obj(p: Dict[str, Any]):
    return render_export.export_obj(p)


@method("export.gltf")
def export_gltf(p: Dict[str, Any]):
    return render_export.export_gltf(p)


@method("export.stl")
def export_stl(p: Dict[str, Any]):
    return render_export.export_stl(p)


@method("export.alembic")
def export_alembic(p: Dict[str, Any]):
    return render_export.export_alembic(p)


@method("export.usd")
def export_usd(p: Dict[str, Any]):
    return render_export.export_usd(p)

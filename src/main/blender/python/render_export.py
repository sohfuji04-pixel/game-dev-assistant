"""レンダー・エクスポート"""

from __future__ import annotations

import os
from typing import Any, Dict

import bpy


def set_engine(p: Dict[str, Any]) -> Dict[str, Any]:
    engine = str(p.get("engine", "EEVEE")).upper()
    # Blender 4.x: BLENDER_EEVEE_NEXT
    if engine in ("EEVEE", "BLENDER_EEVEE"):
        try:
            bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
        except TypeError:
            bpy.context.scene.render.engine = "BLENDER_EEVEE"
    elif engine == "CYCLES":
        bpy.context.scene.render.engine = "CYCLES"
        if p.get("device") == "GPU":
            bpy.context.scene.cycles.device = "GPU"
        if "samples" in p:
            bpy.context.scene.cycles.samples = int(p["samples"])
    else:
        bpy.context.scene.render.engine = engine
    return {"engine": bpy.context.scene.render.engine}


def render_still(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p.get("path") or os.path.join(bpy.app.tempdir, "still.png")
    bpy.context.scene.render.filepath = path
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return {"path": path}


def render_animation(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p.get("path") or os.path.join(bpy.app.tempdir, "anim")
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(animation=True)
    return {"path": path}


def export_blend(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p["path"]
    bpy.ops.wm.save_as_mainfile(filepath=path)
    return {"path": path}


def export_fbx(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p["path"]
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=bool(p.get("selected_only", False)),
        apply_scale_options="FBX_SCALE_ALL",
    )
    return {"path": path}


def export_obj(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p["path"]
    if hasattr(bpy.ops.wm, "obj_export"):
        bpy.ops.wm.obj_export(filepath=path, export_selected_objects=bool(p.get("selected_only", False)))
    else:
        bpy.ops.export_scene.obj(filepath=path, use_selection=bool(p.get("selected_only", False)))
    return {"path": path}


def export_gltf(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p["path"]
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=bool(p.get("selected_only", False)),
        export_format=p.get("format", "GLB"),
    )
    return {"path": path}


def export_stl(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p["path"]
    if hasattr(bpy.ops.wm, "stl_export"):
        bpy.ops.wm.stl_export(filepath=path, export_selected_objects=bool(p.get("selected_only", False)))
    else:
        bpy.ops.export_mesh.stl(filepath=path, use_selection=bool(p.get("selected_only", False)))
    return {"path": path}


def export_alembic(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p["path"]
    bpy.ops.wm.alembic_export(filepath=path, selected=bool(p.get("selected_only", False)))
    return {"path": path}


def export_usd(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p["path"]
    bpy.ops.wm.usd_export(filepath=path, selected_objects_only=bool(p.get("selected_only", False)))
    return {"path": path}

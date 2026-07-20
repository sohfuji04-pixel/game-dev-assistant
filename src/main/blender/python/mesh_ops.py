"""メッシュ編集・UV"""

from __future__ import annotations

from typing import Any, Dict

import bpy


def _active_mesh():
    obj = bpy.context.active_object
    if not obj or obj.type != "MESH":
        raise ValueError("Active mesh object required")
    return obj


def _edit_mode(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.mode != "EDIT":
        bpy.ops.object.mode_set(mode="EDIT")


def uv_smart_project(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=float(p.get("angle_limit", 66.0)))
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def uv_unwrap(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=float(p.get("margin", 0.001)))
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def uv_pack(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.uv.pack_islands(margin=float(p.get("margin", 0.001)))
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def extrude(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.extrude_region_move(
        TRANSFORM_OT_translate={"value": p.get("value", [0, 0, 0.2])}
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def inset(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.inset(thickness=float(p.get("thickness", 0.1)))
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def bevel(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.bevel(offset=float(p.get("offset", 0.05)), segments=int(p.get("segments", 2)))
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def loop_cut(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.loopcut_slide(MESH_OT_loopcut={"number_cuts": int(p.get("cuts", 1))})
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def merge(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.merge(type=p.get("type", "CENTER"))
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def separate(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    _edit_mode(obj)
    bpy.ops.mesh.separate(type=p.get("type", "SELECTED"))
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"object": obj.name}


def join(p: Dict[str, Any]) -> Dict[str, Any]:
    names = p.get("names") or []
    bpy.ops.object.select_all(action="DESELECT")
    for n in names:
        o = bpy.data.objects.get(n)
        if o:
            o.select_set(True)
    if bpy.context.selected_objects:
        bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
        bpy.ops.object.join()
    return {"joined": [o.name for o in bpy.context.selected_objects]}


def remesh(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    mod = obj.modifiers.new(name="Remesh", type="REMESH")
    mod.mode = p.get("mode", "SMOOTH")
    mod.octree_depth = int(p.get("octree_depth", 4))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return {"object": obj.name}


def decimate(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = _active_mesh()
    mod = obj.modifiers.new(name="Decimate", type="DECIMATE")
    mod.ratio = float(p.get("ratio", 0.5))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return {"object": obj.name, "ratio": mod.ratio}

"""Modifier 操作"""

from __future__ import annotations

from typing import Any, Dict

import bpy

MOD_MAP = {
    "subdivision": "SUBSURF",
    "subsurf": "SUBSURF",
    "mirror": "MIRROR",
    "boolean": "BOOLEAN",
    "solidify": "SOLIDIFY",
    "bevel": "BEVEL",
    "array": "ARRAY",
    "decimate": "DECIMATE",
    "remesh": "REMESH",
}


def add_modifier(p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("object")
    obj = bpy.data.objects.get(name) if name else bpy.context.active_object
    if not obj:
        raise ValueError("Object not found")
    kind = str(p.get("type", "subdivision")).lower()
    mod_type = MOD_MAP.get(kind, kind.upper())
    mod = obj.modifiers.new(name=p.get("name", kind), type=mod_type)
    props = p.get("properties") or {}
    for k, v in props.items():
        if hasattr(mod, k):
            setattr(mod, k, v)
    # common shortcuts
    if mod_type == "SUBSURF" and "levels" in p:
        mod.levels = int(p["levels"])
        mod.render_levels = int(p.get("render_levels", p["levels"]))
    if mod_type == "MIRROR" and "use_axis" in p:
        axes = p["use_axis"]
        mod.use_axis[0] = bool(axes[0]) if len(axes) > 0 else False
        mod.use_axis[1] = bool(axes[1]) if len(axes) > 1 else False
        mod.use_axis[2] = bool(axes[2]) if len(axes) > 2 else False
    if mod_type == "BEVEL" and "width" in p:
        mod.width = float(p["width"])
    if mod_type == "ARRAY" and "count" in p:
        mod.count = int(p["count"])
    if mod_type == "BOOLEAN" and "object" in props:
        target = bpy.data.objects.get(props["object"])
        if target:
            mod.object = target
    return {"object": obj.name, "modifier": mod.name, "type": mod_type}


def apply_modifier(p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("object")
    obj = bpy.data.objects.get(name) if name else bpy.context.active_object
    if not obj:
        raise ValueError("Object not found")
    mod_name = p.get("modifier")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    if mod_name:
        bpy.ops.object.modifier_apply(modifier=mod_name)
    else:
        # apply all
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    return {"object": obj.name, "applied": mod_name or "all"}

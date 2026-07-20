"""基本オブジェクト操作"""

from __future__ import annotations

from typing import Any, Dict, List

import bpy
from mathutils import Euler, Vector


def _ensure_object_mode() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def _get_objects(names: List[str] | None) -> List[bpy.types.Object]:
    if not names:
        return list(bpy.context.selected_objects)
    found = []
    for n in names:
        obj = bpy.data.objects.get(n)
        if obj:
            found.append(obj)
    return found


def add_primitive(kind: str, p: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_object_mode()
    loc = p.get("location", [0, 0, 0])
    name = p.get("name")
    size = float(p.get("size", 2.0))
    if kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=size, location=loc)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=size / 2, location=loc)
    elif kind == "plane":
        bpy.ops.mesh.primitive_plane_add(size=size, location=loc)
    else:
        raise ValueError(f"Unknown primitive: {kind}")
    obj = bpy.context.active_object
    if name:
        obj.name = name
        if obj.data:
            obj.data.name = name
    return {"name": obj.name, "type": obj.type}


def delete_objects(p: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_object_mode()
    objs = _get_objects(p.get("names"))
    names = [o.name for o in objs]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.object.delete()
    return {"deleted": names}


def duplicate(p: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_object_mode()
    objs = _get_objects(p.get("names"))
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.object.duplicate()
    created = [o.name for o in bpy.context.selected_objects]
    return {"created": created}


def transform(p: Dict[str, Any], mode: str) -> Dict[str, Any]:
    objs = _get_objects(p.get("names"))
    if not objs:
        raise ValueError("No objects selected")
    value = p.get("value", [0, 0, 0])
    for obj in objs:
        if mode == "translate":
            obj.location += Vector(value)
        elif mode == "rotate":
            # degrees
            obj.rotation_euler.rotate(Euler([v * 3.14159265 / 180.0 for v in value]))
        elif mode == "scale":
            obj.scale = Vector(
                [
                    obj.scale.x * value[0],
                    obj.scale.y * value[1],
                    obj.scale.z * value[2],
                ]
            )
    return {"objects": [o.name for o in objs], "mode": mode, "value": value}


def set_origin(p: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_object_mode()
    objs = _get_objects(p.get("names"))
    typ = p.get("type", "ORIGIN_GEOMETRY")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.origin_set(type=typ)
    return {"objects": [o.name for o in objs], "type": typ}


def rename(p: Dict[str, Any]) -> Dict[str, Any]:
    old = p.get("name")
    new = p.get("new_name")
    obj = bpy.data.objects.get(old)
    if not obj:
        raise ValueError(f"Object not found: {old}")
    obj.name = new
    return {"name": obj.name}


def set_parent(p: Dict[str, Any]) -> Dict[str, Any]:
    child = bpy.data.objects.get(p.get("child"))
    parent = bpy.data.objects.get(p.get("parent"))
    if not child or not parent:
        raise ValueError("child/parent not found")
    child.parent = parent
    return {"child": child.name, "parent": parent.name}


def create_collection(p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("name", "Collection")
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    for n in p.get("objects", []):
        obj = bpy.data.objects.get(n)
        if obj:
            col.objects.link(obj)
    return {"name": col.name}

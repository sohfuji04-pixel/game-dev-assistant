"""マテリアル操作"""

from __future__ import annotations

from typing import Any, Dict

import bpy


def create_material(p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("name", "Material")
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        if "base_color" in p:
            bsdf.inputs["Base Color"].default_value = (*p["base_color"][:3], 1.0)
        if "metallic" in p:
            bsdf.inputs["Metallic"].default_value = float(p["metallic"])
        if "roughness" in p:
            bsdf.inputs["Roughness"].default_value = float(p["roughness"])
        if "emission" in p:
            key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = (*p["emission"][:3], 1.0)
            if "emission_strength" in p and "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = float(p["emission_strength"])
    return {"name": mat.name}


def assign_material(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = bpy.data.objects.get(p.get("object")) if p.get("object") else bpy.context.active_object
    mat = bpy.data.materials.get(p.get("material"))
    if not obj or not mat:
        raise ValueError("object/material not found")
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return {"object": obj.name, "material": mat.name}


def set_property(p: Dict[str, Any]) -> Dict[str, Any]:
    mat = bpy.data.materials.get(p.get("material"))
    if not mat or not mat.use_nodes:
        raise ValueError("material not found")
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    prop = p.get("property")
    value = p.get("value")
    mapping = {
        "base_color": "Base Color",
        "metallic": "Metallic",
        "roughness": "Roughness",
        "emission": "Emission Color",
        "emission_strength": "Emission Strength",
    }
    socket = mapping.get(prop, prop)
    if socket not in bsdf.inputs:
        # Blender 3.x Emission
        if prop == "emission" and "Emission" in bsdf.inputs:
            socket = "Emission"
        else:
            raise ValueError(f"Unknown property: {prop}")
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        bsdf.inputs[socket].default_value = (*value[:3], 1.0 if len(value) < 4 else value[3])
    else:
        bsdf.inputs[socket].default_value = value
    return {"material": mat.name, "property": prop}


def delete_material(p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("name")
    mat = bpy.data.materials.get(name)
    if not mat:
        raise ValueError(f"Material not found: {name}")
    bpy.data.materials.remove(mat)
    return {"deleted": name}

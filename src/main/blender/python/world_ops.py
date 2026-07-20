"""ワールド・カメラ・ライト"""

from __future__ import annotations

from typing import Any, Dict

import bpy
from mathutils import Euler


def set_hdri(p: Dict[str, Any]) -> Dict[str, Any]:
    path = p.get("path")
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputWorld")
    bg = nodes.new("ShaderNodeBackground")
    if path:
        env = nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(path)
        links.new(env.outputs["Color"], bg.inputs["Color"])
    else:
        color = p.get("color", [0.05, 0.05, 0.08])
        bg.inputs["Color"].default_value = (*color[:3], 1.0)
    bg.inputs["Strength"].default_value = float(p.get("strength", 1.0))
    links.new(bg.outputs["Background"], out.inputs["Surface"])
    return {"ok": True, "path": path}


def set_time_of_day(p: Dict[str, Any]) -> Dict[str, Any]:
    mode = p.get("mode", "day")
    presets = {
        "day": {"color": (0.55, 0.75, 1.0), "strength": 1.0, "sun_energy": 5.0, "sun_rot": (0.8, 0.0, 0.5)},
        "daylight": {"color": (0.55, 0.75, 1.0), "strength": 1.0, "sun_energy": 5.0, "sun_rot": (0.8, 0.0, 0.5)},
        "sunset": {"color": (1.0, 0.45, 0.2), "strength": 0.8, "sun_energy": 3.0, "sun_rot": (1.4, 0.0, 0.8)},
        "evening": {"color": (1.0, 0.45, 0.2), "strength": 0.8, "sun_energy": 3.0, "sun_rot": (1.4, 0.0, 0.8)},
        "night": {"color": (0.02, 0.03, 0.08), "strength": 0.2, "sun_energy": 0.1, "sun_rot": (2.5, 0.0, 0.2)},
    }
    preset = presets.get(mode, presets["day"])
    set_hdri({"color": preset["color"], "strength": preset["strength"]})

    sun = None
    for obj in bpy.data.objects:
        if obj.type == "LIGHT" and obj.data.type == "SUN":
            sun = obj
            break
    if not sun:
        light_data = bpy.data.lights.new(name="Sun", type="SUN")
        sun = bpy.data.objects.new(name="Sun", object_data=light_data)
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = preset["sun_energy"]
    sun.rotation_euler = Euler(preset["sun_rot"])
    return {"mode": mode}


def add_camera(p: Dict[str, Any]) -> Dict[str, Any]:
    cam_data = bpy.data.cameras.new(p.get("name", "Camera"))
    cam = bpy.data.objects.new(cam_data.name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = p.get("location", [7, -7, 5])
    if p.get("dof"):
        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = float(p.get("focus_distance", 10.0))
    if p.get("set_active", True):
        bpy.context.scene.camera = cam
    return {"name": cam.name}


def add_light(p: Dict[str, Any]) -> Dict[str, Any]:
    kind = str(p.get("type", "SUN")).upper()
    light_data = bpy.data.lights.new(name=p.get("name", kind), type=kind)
    light_data.energy = float(p.get("energy", 5.0))
    if "shadow" in p:
        light_data.use_shadow = bool(p["shadow"])
    obj = bpy.data.objects.new(name=light_data.name, object_data=light_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = p.get("location", [4, 1, 6])
    return {"name": obj.name, "type": kind}

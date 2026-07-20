"""
ゲーム向けテンプレート生成
プリミティブ組み合わせでプロシージャルに簡易モデルを作る
"""

from __future__ import annotations

import math
import random
from typing import Any, Callable, Dict, List

import bpy
from mathutils import Vector

from . import materials, objects, world_ops


def _mat(name: str, color: tuple, emission: tuple | None = None, metallic=0.0, roughness=0.5):
    params: Dict[str, Any] = {
        "name": name,
        "base_color": list(color),
        "metallic": metallic,
        "roughness": roughness,
    }
    if emission:
        params["emission"] = list(emission)
        params["emission_strength"] = 2.0
    return materials.create_material(params)["name"]


def _assign(obj_name: str, mat_name: str):
    materials.assign_material({"object": obj_name, "material": mat_name})


def create_chibi(p: Dict[str, Any]) -> Dict[str, Any]:
    """二頭身キャラクター（簡易）"""
    root = p.get("name", "Chibi")
    col = objects.create_collection({"name": root})
    # body
    objects.add_primitive("cube", {"name": f"{root}_Body", "size": 0.8, "location": [0, 0, 0.7]})
    bpy.data.objects[f"{root}_Body"].scale = (0.7, 0.5, 0.9)
    # head
    objects.add_primitive("sphere", {"name": f"{root}_Head", "size": 1.0, "location": [0, 0, 1.55]})
    # eyes
    objects.add_primitive("sphere", {"name": f"{root}_EyeL", "size": 0.18, "location": [-0.18, -0.42, 1.6]})
    objects.add_primitive("sphere", {"name": f"{root}_EyeR", "size": 0.18, "location": [0.18, -0.42, 1.6]})
    # hair
    objects.add_primitive("sphere", {"name": f"{root}_Hair", "size": 1.1, "location": [0, 0.05, 1.7]})
    bpy.data.objects[f"{root}_Hair"].scale = (1.05, 1.1, 0.7)
    skin = _mat(f"{root}_Skin", (1.0, 0.82, 0.72))
    cloth = _mat(f"{root}_Cloth", (0.35, 0.7, 0.4))
    hair = _mat(f"{root}_HairMat", (0.45, 0.25, 0.1))
    eye = _mat(f"{root}_EyeMat", (0.05, 0.05, 0.08))
    _assign(f"{root}_Body", cloth)
    _assign(f"{root}_Head", skin)
    _assign(f"{root}_EyeL", eye)
    _assign(f"{root}_EyeR", eye)
    _assign(f"{root}_Hair", hair)
    parts = [f"{root}_Body", f"{root}_Head", f"{root}_EyeL", f"{root}_EyeR", f"{root}_Hair"]
    objects.create_collection({"name": root, "objects": parts})
    return {"name": root, "parts": parts, "collection": col["name"]}


def _farm_girl(p: Dict[str, Any]) -> Dict[str, Any]:
    result = create_chibi({"name": p.get("name", "FarmGirl")})
    # hat
    objects.add_primitive("cube", {"name": "FarmGirl_Hat", "size": 0.9, "location": [0, 0, 2.0]})
    bpy.data.objects["FarmGirl_Hat"].scale = (1.2, 1.2, 0.15)
    hat_mat = _mat("FarmGirl_HatMat", (0.85, 0.75, 0.35))
    _assign("FarmGirl_Hat", hat_mat)
    result["parts"].append("FarmGirl_Hat")
    return result


def _animal(kind: str, p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("name", kind.capitalize())
    if kind == "sheep":
        objects.add_primitive("sphere", {"name": f"{name}_Body", "size": 1.2, "location": [0, 0, 0.7]})
        objects.add_primitive("sphere", {"name": f"{name}_Head", "size": 0.55, "location": [0, -0.7, 0.85]})
        wool = _mat(f"{name}_Wool", (0.95, 0.95, 0.92))
        skin = _mat(f"{name}_Skin", (0.9, 0.8, 0.7))
        _assign(f"{name}_Body", wool)
        _assign(f"{name}_Head", skin)
        return {"name": name, "parts": [f"{name}_Body", f"{name}_Head"]}
    if kind == "cow":
        objects.add_primitive("cube", {"name": f"{name}_Body", "size": 1.4, "location": [0, 0, 1.0]})
        bpy.data.objects[f"{name}_Body"].scale = (0.7, 1.2, 0.7)
        objects.add_primitive("sphere", {"name": f"{name}_Head", "size": 0.7, "location": [0, -1.0, 1.3]})
        body = _mat(f"{name}_BodyMat", (0.9, 0.9, 0.88))
        _assign(f"{name}_Body", body)
        _assign(f"{name}_Head", body)
        return {"name": name, "parts": [f"{name}_Body", f"{name}_Head"]}
    if kind == "chicken":
        objects.add_primitive("sphere", {"name": f"{name}_Body", "size": 0.6, "location": [0, 0, 0.45]})
        objects.add_primitive("sphere", {"name": f"{name}_Head", "size": 0.35, "location": [0, -0.35, 0.75]})
        white = _mat(f"{name}_White", (0.95, 0.95, 0.9))
        _assign(f"{name}_Body", white)
        _assign(f"{name}_Head", white)
        return {"name": name, "parts": [f"{name}_Body", f"{name}_Head"]}
    raise ValueError(kind)


def _tree(p: Dict[str, Any], world=False) -> Dict[str, Any]:
    name = p.get("name", "WorldTree" if world else "Tree")
    trunk_h = 8.0 if world else 2.0
    trunk_s = 1.5 if world else 0.4
    objects.add_primitive("cube", {"name": f"{name}_Trunk", "size": 1.0, "location": [0, 0, trunk_h / 2]})
    bpy.data.objects[f"{name}_Trunk"].scale = (trunk_s, trunk_s, trunk_h)
    canopy_z = trunk_h + (2.0 if world else 0.8)
    objects.add_primitive("sphere", {"name": f"{name}_Canopy", "size": 6.0 if world else 2.0, "location": [0, 0, canopy_z]})
    bark = _mat(f"{name}_Bark", (0.35, 0.22, 0.12))
    leaf = _mat(f"{name}_Leaf", (0.2, 0.55, 0.25))
    _assign(f"{name}_Trunk", bark)
    _assign(f"{name}_Canopy", leaf)
    return {"name": name, "parts": [f"{name}_Trunk", f"{name}_Canopy"]}


def _crystal(p: Dict[str, Any]) -> Dict[str, Any]:
    name = p.get("name", "Crystal")
    objects.add_primitive("cube", {"name": name, "size": 1.0, "location": [0, 0, 0.8]})
    obj = bpy.data.objects[name]
    obj.scale = (0.5, 0.5, 1.4)
    obj.rotation_euler[2] = math.radians(45)
    mat = _mat(name + "Mat", (0.4, 0.8, 1.0), emission=(0.2, 0.6, 1.0), metallic=0.3, roughness=0.15)
    _assign(name, mat)
    return {"name": name}


def _farm(p: Dict[str, Any]) -> Dict[str, Any]:
    objects.add_primitive("plane", {"name": "FarmGround", "size": 20, "location": [0, 0, 0]})
    ground = _mat("FarmGroundMat", (0.35, 0.55, 0.25))
    _assign("FarmGround", ground)
    # fence posts
    posts = []
    for i, x in enumerate(range(-8, 9, 4)):
        n = f"Fence_{i}"
        objects.add_primitive("cube", {"name": n, "size": 0.3, "location": [x, -8, 0.5]})
        bpy.data.objects[n].scale = (0.3, 0.3, 1.0)
        posts.append(n)
    _tree({"name": "FarmTree"})
    world_ops.set_time_of_day({"mode": "day"})
    return {"name": "Farm", "parts": ["FarmGround", *posts, "FarmTree_Trunk", "FarmTree_Canopy"]}


def _island(p: Dict[str, Any]) -> Dict[str, Any]:
    objects.add_primitive("sphere", {"name": "Island", "size": 6, "location": [0, 0, -1]})
    bpy.data.objects["Island"].scale = (1.5, 1.5, 0.4)
    mat = _mat("IslandMat", (0.45, 0.7, 0.35))
    _assign("Island", mat)
    return {"name": "Island"}


def _puzzle(p: Dict[str, Any]) -> Dict[str, Any]:
    objects.add_primitive("cube", {"name": "PuzzlePiece", "size": 1.5, "location": [0, 0, 0.75]})
    mat = _mat("PuzzleMat", (0.9, 0.35, 0.4))
    _assign("PuzzlePiece", mat)
    return {"name": "PuzzlePiece"}


def _scatter(kind: str, p: Dict[str, Any]) -> Dict[str, Any]:
    count = int(p.get("count", 20))
    spread = float(p.get("spread", 8.0))
    created: List[str] = []
    rng = random.Random(p.get("seed", 42))
    for i in range(count):
        x = rng.uniform(-spread, spread)
        y = rng.uniform(-spread, spread)
        name = f"{kind}_{i}"
        if kind == "flower":
            objects.add_primitive("sphere", {"name": name, "size": 0.15, "location": [x, y, 0.1]})
            color = rng.choice([(1, 0.4, 0.5), (1, 0.85, 0.3), (0.7, 0.5, 1.0)])
            _assign(name, _mat(f"{name}_Mat", color))
        elif kind == "grass":
            objects.add_primitive("cube", {"name": name, "size": 0.1, "location": [x, y, 0.15]})
            bpy.data.objects[name].scale = (0.2, 0.2, 1.5)
            _assign(name, _mat("GrassMat", (0.25, 0.6, 0.2)))
        elif kind == "rock":
            objects.add_primitive("sphere", {"name": name, "size": rng.uniform(0.3, 0.8), "location": [x, y, 0.2]})
            _assign(name, _mat("RockMat", (0.45, 0.45, 0.42), roughness=0.9))
        created.append(name)
    return {"created": created, "count": count}


def create_armature(p: Dict[str, Any]) -> Dict[str, Any]:
    bpy.ops.object.armature_add(location=p.get("location", [0, 0, 0]))
    arm = bpy.context.active_object
    arm.name = p.get("name", "Armature")
    return {"name": arm.name}


def add_bone(p: Dict[str, Any]) -> Dict[str, Any]:
    arm = bpy.data.objects.get(p.get("armature"))
    if not arm or arm.type != "ARMATURE":
        raise ValueError("armature not found")
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    bone = arm.data.edit_bones.new(p.get("name", "Bone"))
    bone.head = Vector(p.get("head", [0, 0, 0]))
    bone.tail = Vector(p.get("tail", [0, 0, 1]))
    parent = p.get("parent")
    if parent and parent in arm.data.edit_bones:
        bone.parent = arm.data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"name": bone.name}


def auto_weight(p: Dict[str, Any]) -> Dict[str, Any]:
    mesh = bpy.data.objects.get(p.get("mesh"))
    arm = bpy.data.objects.get(p.get("armature"))
    if not mesh or not arm:
        raise ValueError("mesh/armature required")
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    return {"mesh": mesh.name, "armature": arm.name}


def add_ik(p: Dict[str, Any]) -> Dict[str, Any]:
    arm = bpy.data.objects.get(p.get("armature"))
    bone = p.get("bone")
    if not arm:
        raise ValueError("armature required")
    pb = arm.pose.bones.get(bone)
    if not pb:
        raise ValueError(f"bone not found: {bone}")
    c = pb.constraints.new("IK")
    c.chain_count = int(p.get("chain_count", 2))
    return {"bone": bone, "constraint": c.name}


def add_anim_clip(p: Dict[str, Any]) -> Dict[str, Any]:
    """簡易クリップ: Idle/Walk/Run 等のプレースホルダキー"""
    name = p.get("name", "Idle")
    obj = bpy.data.objects.get(p.get("object")) if p.get("object") else bpy.context.active_object
    if not obj:
        raise ValueError("object required")
    if not obj.animation_data:
        obj.animation_data_create()
    action = bpy.data.actions.new(name=name)
    obj.animation_data.action = action
    # simple Z bounce / forward keyframes
    frames = {"Idle": [(1, 0), (20, 0.05), (40, 0)], "Walk": [(1, 0), (10, 0.1), (20, 0), (30, 0.1), (40, 0)], "Run": [(1, 0), (5, 0.15), (10, 0), (15, 0.15), (20, 0)]}
    keys = frames.get(name, frames["Idle"])
    for frame, z in keys:
        obj.location.z = z
        obj.keyframe_insert(data_path="location", frame=frame, index=2)
    return {"action": action.name, "frames": len(keys)}


def insert_keyframe(p: Dict[str, Any]) -> Dict[str, Any]:
    obj = bpy.data.objects.get(p.get("object")) if p.get("object") else bpy.context.active_object
    frame = int(p.get("frame", bpy.context.scene.frame_current))
    data_path = p.get("data_path", "location")
    obj.keyframe_insert(data_path=data_path, frame=frame)
    return {"object": obj.name, "frame": frame, "data_path": data_path}


_TEMPLATES: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
    "farm_girl": _farm_girl,
    "cute_sheep": lambda p: _animal("sheep", p),
    "cow": lambda p: _animal("cow", p),
    "chicken": lambda p: _animal("chicken", p),
    "tree": lambda p: _tree(p, False),
    "world_tree": lambda p: _tree(p, True),
    "crystal": _crystal,
    "farm": _farm,
    "island": _island,
    "puzzle_piece": _puzzle,
    "place_flowers": lambda p: _scatter("flower", p),
    "scatter_grass": lambda p: _scatter("grass", p),
    "place_rocks": lambda p: _scatter("rock", p),
    "daylight": lambda p: world_ops.set_time_of_day({"mode": "day"}),
    "sunset": lambda p: world_ops.set_time_of_day({"mode": "sunset"}),
}


def run_template(p: Dict[str, Any]) -> Dict[str, Any]:
    key = p.get("key") or p.get("id")
    if key in ("export_fbx", "export_gltf"):
        from . import render_export

        path = p.get("path") or bpy.path.abspath(f"//{key}.{'fbx' if key == 'export_fbx' else 'glb'}")
        if key == "export_fbx":
            return render_export.export_fbx({"path": path, **p})
        return render_export.export_gltf({"path": path, **p})
    fn = _TEMPLATES.get(key)
    if not fn:
        raise ValueError(f"Unknown template: {key}")
    result = fn(p)
    return {"template": key, "result": result}

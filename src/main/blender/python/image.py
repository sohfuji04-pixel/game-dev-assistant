"""写真 / 画像からの生成（プレーン取り込み・簡易リlief）"""

from __future__ import annotations

import base64
import os
import tempfile
from typing import Any, Dict, Tuple

import bpy


def _load_image(p: Dict[str, Any]) -> Tuple[bpy.types.Image, str]:
    """path または base64 から画像を読み込む"""
    path = p.get("path")
    if path and os.path.isfile(path):
        img = bpy.data.images.load(path, check_existing=True)
        return img, path

    data_b64 = p.get("data")
    if not data_b64:
        raise ValueError("path または data(base64) が必要です")

    ext = str(p.get("ext", "png")).lstrip(".")
    fd, tmp = tempfile.mkstemp(suffix=f".{ext}", prefix="gda_photo_")
    os.close(fd)
    with open(tmp, "wb") as f:
        f.write(base64.b64decode(data_b64))
    img = bpy.data.images.load(tmp, check_existing=False)
    return img, tmp


def _make_image_material(name: str, image: bpy.types.Image) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def import_as_plane(p: Dict[str, Any]) -> Dict[str, Any]:
    """写真をテクスチャ付きプレーンとして配置"""
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    img, src = _load_image(p)
    w, h = img.size
    aspect = (w / max(h, 1)) if h else 1.0
    size = float(p.get("size", 2.0))
    name = str(p.get("name", "PhotoPlane"))

    bpy.ops.mesh.primitive_plane_add(size=size, location=p.get("location", [0, 0, 1]))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (aspect, 1.0, 1.0)
    # 立たせて見やすく
    if p.get("standup", True):
        obj.rotation_euler = (1.5708, 0.0, 0.0)

    mat = _make_image_material(f"{name}_Mat", img)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

    return {
        "ok": True,
        "object": obj.name,
        "image": img.name,
        "width": w,
        "height": h,
        "aspect": aspect,
        "source": src,
    }


def generate_from_photo(p: Dict[str, Any]) -> Dict[str, Any]:
    """
    写真から簡易 3D を生成。
    mode:
      - reference: 参照プレーンのみ
      - relief: プレーン + Solidify（厚み）
      - scene: 参照プレーン + 床 + ライト
    """
    mode = str(p.get("mode", "scene")).lower()
    imported = import_as_plane(p)
    obj = bpy.data.objects.get(imported["object"])
    created = [imported["object"]]

    if obj and mode in ("relief", "scene"):
        solid = obj.modifiers.new(name="PhotoSolidify", type="SOLIDIFY")
        solid.thickness = float(p.get("thickness", 0.15))
        solid.offset = 0.0

    if mode == "scene":
        # 床
        bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
        floor = bpy.context.active_object
        floor.name = "PhotoFloor"
        created.append(floor.name)

        # ライト
        bpy.ops.object.light_add(type="AREA", location=(2, -2, 4))
        light = bpy.context.active_object
        light.name = "PhotoLight"
        light.data.energy = 200
        created.append(light.name)

        # カメラ
        if bpy.context.scene.camera is None:
            bpy.ops.object.camera_add(location=(4, -4, 2.5), rotation=(1.1, 0, 0.8))
            cam = bpy.context.active_object
            bpy.context.scene.camera = cam
            created.append(cam.name)

    return {
        "ok": True,
        "mode": mode,
        "imported": imported,
        "created": created,
    }

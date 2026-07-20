"""ビューポート / 簡易レンダープレビュー（PNG base64）"""

from __future__ import annotations

import base64
import os
import tempfile
from typing import Any, Dict

import bpy


def _ensure_camera() -> str:
    """アクティブカメラが無ければ簡易カメラを追加して返す"""
    cam = bpy.context.scene.camera
    if cam is not None:
        return cam.name

    bpy.ops.object.camera_add(location=(7.0, -7.0, 5.0), rotation=(1.1, 0.0, 0.785))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    # シーン全体をざっくり映す
    try:
        bpy.ops.view3d.camera_to_view_selected()
    except Exception:
        pass
    return cam.name


def capture_preview(p: Dict[str, Any]) -> Dict[str, Any]:
    """
    ビューポート OpenGL プレビューを PNG base64 で返す。
    失敗時は低サンプル EEVEE レンダーにフォールバック。
    """
    width = max(160, min(int(p.get("width", 720)), 1920))
    height = max(90, min(int(p.get("height", 405)), 1080))
    mode = str(p.get("mode", "viewport")).lower()  # viewport | render

    scene = bpy.context.scene
    render = scene.render

    prev = {
        "filepath": render.filepath,
        "res_x": render.resolution_x,
        "res_y": render.resolution_y,
        "pct": render.resolution_percentage,
        "fmt": render.image_settings.file_format,
        "engine": render.engine,
    }

    fd, path = tempfile.mkstemp(suffix=".png", prefix="gda_preview_")
    os.close(fd)
    try:
        render.filepath = path
        render.resolution_x = width
        render.resolution_y = height
        render.resolution_percentage = 100
        render.image_settings.file_format = "PNG"

        used = "viewport"
        if mode == "render":
            used = _render_eevee_fast(scene)
        else:
            try:
                _ensure_camera()
                # GUI がある場合の高速プレビュー
                bpy.ops.render.opengl(write_still=True)
            except Exception:
                used = _render_eevee_fast(scene)

        if not os.path.exists(path) or os.path.getsize(path) == 0:
            raise RuntimeError("プレビュー画像の生成に失敗しました")

        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode("ascii")

        return {
            "ok": True,
            "mimeType": "image/png",
            "data": data,
            "width": width,
            "height": height,
            "mode": used,
            "objectCount": len(bpy.data.objects),
            "camera": scene.camera.name if scene.camera else None,
        }
    finally:
        render.filepath = prev["filepath"]
        render.resolution_x = prev["res_x"]
        render.resolution_y = prev["res_y"]
        render.resolution_percentage = prev["pct"]
        render.image_settings.file_format = prev["fmt"]
        try:
            render.engine = prev["engine"]
        except Exception:
            pass
        try:
            os.remove(path)
        except OSError:
            pass


def _render_eevee_fast(scene: bpy.types.Scene) -> str:
    _ensure_camera()
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    # プレビュー用に軽く
    eevee = getattr(scene, "eevee", None)
    prev_samples = None
    if eevee is not None and hasattr(eevee, "taa_render_samples"):
        prev_samples = eevee.taa_render_samples
        eevee.taa_render_samples = 8
    try:
        bpy.ops.render.render(write_still=True)
    finally:
        if eevee is not None and prev_samples is not None:
            eevee.taa_render_samples = prev_samples
    return "render"

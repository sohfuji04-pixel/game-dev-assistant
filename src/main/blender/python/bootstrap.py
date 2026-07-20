"""
Blender 起動時にブリッジを開始するブートストラップ
Usage: blender --python bootstrap.py -- --bridge-port=8775
"""

from __future__ import annotations

import os
import sys

# パッケージパスを追加
ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, os.path.dirname(ROOT))

# 同ディレクトリをパッケージとして扱う
PKG = ROOT
if PKG not in sys.path:
    sys.path.insert(0, PKG)


def _parse_port() -> int:
    port = 8775
    for arg in sys.argv:
        if arg.startswith("--bridge-port="):
            port = int(arg.split("=", 1)[1])
    return port


def main():
    # 相対 import が効くようモジュールとしてロード
    import importlib.util

    server_path = os.path.join(ROOT, "server.py")
    spec = importlib.util.spec_from_file_location("baa_server", server_path)
    server = importlib.util.module_from_spec(spec)
    # handlers などが相対 import できるようパッケージ擬似化
    sys.modules["baa"] = type(sys)("baa")
    sys.modules["baa"].__path__ = [ROOT]

    # サブモジュールを先に登録
    for name in [
        "objects",
        "modifiers",
        "materials",
        "mesh_ops",
        "world_ops",
        "render_export",
        "templates",
        "viewport",
        "image",
        "handlers",
        "server",
    ]:
        path = os.path.join(ROOT, f"{name}.py")
        spec_m = importlib.util.spec_from_file_location(f"baa.{name}", path)
        mod = importlib.util.module_from_spec(spec_m)
        sys.modules[f"baa.{name}"] = mod
        # patch package-relative imports: rewrite "from ." in loaded modules by setting __package__
        mod.__package__ = "baa"
        spec_m.loader.exec_module(mod)

    port = _parse_port()
    sys.modules["baa.server"].start(port)
    print(f"[BlenderAI] bootstrap ready on port {port}")


if __name__ == "__main__":
    main()

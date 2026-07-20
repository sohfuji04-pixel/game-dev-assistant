"""
Blender AI Assistant — JSON-RPC WebSocket Bridge
Python は Blender 操作専用。Node 側から ws://host:port で接続する。

使い方:
  1. このディレクトリを Blender アドオンとしてインストール
  2. または: blender --python bootstrap.py -- --bridge-port=8775
"""

bl_info = {
    "name": "Blender AI Assistant Bridge",
    "author": "Blender AI Assistant",
    "version": (0, 1, 0),
    "blender": (3, 6, 0),
    "location": "Preferences > Add-ons",
    "description": "JSON-RPC WebSocket bridge for Blender AI Assistant",
    "category": "System",
}

from . import server


def register():
    server.register()


def unregister():
    server.unregister()

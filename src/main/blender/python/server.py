"""
WebSocket JSON-RPC サーバー（標準ライブラリのみ）
Blender のタイマーで非同期 accept / recv を処理する
"""

from __future__ import annotations

import json
import socket
import struct
import threading
import traceback
from typing import Any, Callable, Dict, Optional, Tuple

import bpy

from . import handlers

DEFAULT_PORT = 8775

_server_sock: Optional[socket.socket] = None
_clients: list[socket.socket] = []
_lock = threading.Lock()
_port = DEFAULT_PORT
_timer_running = False


def _recv_exact(conn: socket.socket, n: int) -> Optional[bytes]:
    buf = b""
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def _ws_accept_handshake(conn: socket.socket) -> bool:
    """簡易 WebSocket ハンドシェイク"""
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = conn.recv(4096)
        if not chunk:
            return False
        data += chunk
    headers = data.decode("utf-8", errors="ignore")
    key = None
    for line in headers.split("\r\n"):
        if line.lower().startswith("sec-websocket-key:"):
            key = line.split(":", 1)[1].strip()
            break
    if not key:
        return False
    import hashlib
    import base64

    accept = base64.b64encode(
        hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
    ).decode()
    response = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n"
        "\r\n"
    )
    conn.sendall(response.encode())
    return True


def _ws_read_frame(conn: socket.socket) -> Optional[bytes]:
    header = _recv_exact(conn, 2)
    if not header:
        return None
    b1, b2 = header[0], header[1]
    opcode = b1 & 0x0F
    masked = (b2 & 0x80) != 0
    length = b2 & 0x7F
    if length == 126:
        ext = _recv_exact(conn, 2)
        if not ext:
            return None
        length = struct.unpack("!H", ext)[0]
    elif length == 127:
        ext = _recv_exact(conn, 8)
        if not ext:
            return None
        length = struct.unpack("!Q", ext)[0]
    mask = _recv_exact(conn, 4) if masked else b"\x00\x00\x00\x00"
    if mask is None:
        return None
    payload = _recv_exact(conn, length)
    if payload is None:
        return None
    if masked:
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    if opcode == 0x8:  # close
        return None
    if opcode == 0x9:  # ping -> pong
        _ws_send_frame(conn, payload, opcode=0xA)
        return b""
    return payload


def _ws_send_frame(conn: socket.socket, payload: bytes, opcode: int = 0x1) -> None:
    header = bytearray()
    header.append(0x80 | opcode)
    length = len(payload)
    if length < 126:
        header.append(length)
    elif length < 65536:
        header.append(126)
        header.extend(struct.pack("!H", length))
    else:
        header.append(127)
        header.extend(struct.pack("!Q", length))
    conn.sendall(header + payload)


def _handle_request(raw: bytes) -> bytes:
    try:
        req = json.loads(raw.decode("utf-8"))
    except Exception as e:
        return json.dumps(
            {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": f"Parse error: {e}"}}
        ).encode()

    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params") or {}
    if not isinstance(params, dict):
        params = {"_args": params}

    try:
        result = handlers.dispatch(method, params)
        return json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}, ensure_ascii=False).encode()
    except Exception as e:
        return json.dumps(
            {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32000,
                    "message": str(e),
                    "data": traceback.format_exc(),
                },
            },
            ensure_ascii=False,
        ).encode()


def _accept_loop() -> None:
    global _server_sock
    while _server_sock:
        try:
            _server_sock.settimeout(0.5)
            try:
                conn, _addr = _server_sock.accept()
            except socket.timeout:
                continue
            conn.settimeout(5)
            if not _ws_accept_handshake(conn):
                conn.close()
                continue
            conn.settimeout(0.05)
            with _lock:
                _clients.append(conn)
        except OSError:
            break


def _poll_clients() -> float:
    """Blender タイマーコールバック — メインスレッドで RPC を実行"""
    dead: list[socket.socket] = []
    with _lock:
        clients = list(_clients)
    for conn in clients:
        try:
            while True:
                payload = _ws_read_frame(conn)
                if payload is None:
                    dead.append(conn)
                    break
                if payload == b"":
                    continue
                response = _handle_request(payload)
                _ws_send_frame(conn, response)
        except (BlockingIOError, socket.timeout):
            continue
        except OSError:
            dead.append(conn)
    if dead:
        with _lock:
            for c in dead:
                if c in _clients:
                    _clients.remove(c)
                try:
                    c.close()
                except OSError:
                    pass
    return 0.05


def start(port: int = DEFAULT_PORT) -> None:
    global _server_sock, _port, _timer_running
    stop()
    _port = port
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", port))
    sock.listen(5)
    _server_sock = sock
    t = threading.Thread(target=_accept_loop, daemon=True)
    t.start()
    if not _timer_running:
        bpy.app.timers.register(_poll_clients, first_interval=0.1, persistent=True)
        _timer_running = True
    print(f"[BlenderAI] Bridge listening on ws://127.0.0.1:{port}")


def stop() -> None:
    global _server_sock, _timer_running
    if _server_sock:
        try:
            _server_sock.close()
        except OSError:
            pass
        _server_sock = None
    with _lock:
        for c in _clients:
            try:
                c.close()
            except OSError:
                pass
        _clients.clear()
    if _timer_running and bpy.app.timers.is_registered(_poll_clients):
        bpy.app.timers.unregister(_poll_clients)
        _timer_running = False


def register() -> None:
    start(DEFAULT_PORT)


def unregister() -> None:
    stop()

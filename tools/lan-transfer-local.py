#!/usr/bin/env python3
"""Tiny LAN Transfer local client.

Run on the desktop, then open the printed LAN URL from phones/tablets.
Uses only Python standard library; no Electron, npm, or node_modules.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import secrets
import socket
import sys
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
API_BASE = "/work/lan-transfer/api"
APP_PATH = "/work/lan-transfer/"
AUTH_CONFIG_PATH = "/work/lan-transfer/auth-config.js"
CODE_DIGITS = 4
SESSION_TTL_MS = 15 * 60 * 1000
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_SESSION_COUNT = 9000

sessions: dict[str, dict[str, object]] = {}


def now_ms() -> int:
    return int(time.time() * 1000)


def cleanup_sessions() -> None:
    current = now_ms()
    expired = [
        code
        for code, session in sessions.items()
        if current - int(session.get("createdAt", 0)) > SESSION_TTL_MS
    ]
    for code in expired:
        sessions.pop(code, None)


def create_code() -> str:
    cleanup_sessions()
    if len(sessions) >= MAX_SESSION_COUNT:
        raise RuntimeError("短码池暂时已满，请稍后重试")

    for _ in range(128):
        code = f"{secrets.randbelow(10 ** CODE_DIGITS):0{CODE_DIGITS}d}"
        if code not in sessions:
            return code

    for value in range(10 ** CODE_DIGITS):
        code = f"{value:0{CODE_DIGITS}d}"
        if code not in sessions:
            return code

    raise RuntimeError("短码池暂时已满，请稍后重试")


def resolve_code(code: str) -> str | None:
    if code in sessions:
        return code
    if code.isdigit() and len(code) < CODE_DIGITS:
        padded = code.zfill(CODE_DIGITS)
        if padded in sessions:
            return padded
    return None


def local_addresses() -> list[str]:
    addresses: set[str] = set()

    try:
        for item in socket.gethostbyname_ex(socket.gethostname())[2]:
            addresses.add(item)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            # UDP connect chooses the outbound interface without sending payload.
            probe.connect(("192.0.2.1", 80))
            addresses.add(probe.getsockname()[0])
    except OSError:
        pass

    return sorted(
        address
        for address in addresses
        if not address.startswith("127.")
        and not address.startswith("169.254.")
        and address != "0.0.0.0"
    )


def interface_entries(port: int) -> list[dict[str, str]]:
    return [
        {
            "name": f"LAN {index}",
            "address": address,
            "url": f"http://{address}:{port}{APP_PATH}",
        }
        for index, address in enumerate(local_addresses(), start=1)
    ]


class LanTransferHandler(SimpleHTTPRequestHandler):
    server_version = "XYXLanTransfer/1.0"

    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_OPTIONS(self) -> None:
        if self.is_api_path():
            self.send_no_content()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_HEAD(self) -> None:
        if self.is_api_path():
            self.handle_api(send_body=False)
            return
        if self.current_path() == AUTH_CONFIG_PATH:
            self.send_local_auth_config(send_body=False)
            return
        super().do_HEAD()

    def do_GET(self) -> None:
        path = self.current_path()
        if path == "/":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", APP_PATH)
            self.end_headers()
            return
        if path == AUTH_CONFIG_PATH:
            self.send_local_auth_config(send_body=True)
            return
        if self.is_api_path():
            self.handle_api(send_body=True)
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.is_api_path():
            self.handle_api(send_body=True)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def current_path(self) -> str:
        return urlparse(self.path).path.rstrip("/") or "/"

    def api_path(self) -> str:
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == API_BASE:
            return "/"
        if path.startswith(f"{API_BASE}/"):
            return path[len(API_BASE):] or "/"
        return path

    def is_api_path(self) -> bool:
        path = urlparse(self.path).path
        return path == API_BASE or path.startswith(f"{API_BASE}/")

    def send_no_content(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

    def send_json(self, status: int, data: object, send_body: bool = True) -> None:
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if send_body:
            self.wfile.write(body)

    def send_local_auth_config(self, send_body: bool = True) -> None:
        body = (
            'window.XYX_LAN_TRANSFER_AUTH = {"localBypass":true,'
            '"username":"","passwordHash":""};\n'
        ).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if send_body:
            self.wfile.write(body)

    def read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length") or "0")
        if length > MAX_JSON_BYTES:
            raise ValueError("请求内容过大")
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError("JSON 格式不正确") from error

    def handle_api(self, send_body: bool) -> None:
        try:
            self._handle_api(send_body)
        except Exception as error:  # noqa: BLE001 - convert all local failures to JSON.
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)}, send_body)

    def _handle_api(self, send_body: bool) -> None:
        path = self.api_path()
        method = self.command.upper()
        port = int(getattr(self.server, "lan_port", 5181))

        if method == "GET" and path == "/":
            self.send_json(HTTPStatus.OK, {
                "ok": True,
                "service": "lan-transfer-local",
                "codeDigits": CODE_DIGITS,
                "expiresMs": SESSION_TTL_MS,
                "endpoints": {
                    "health": f"{API_BASE}/health",
                    "network": f"{API_BASE}/network",
                    "offers": f"{API_BASE}/offers",
                    "offer": f"{API_BASE}/offers/:code",
                    "answers": f"{API_BASE}/answers/:code",
                },
            }, send_body)
            return

        if method == "GET" and path == "/health":
            self.send_json(HTTPStatus.OK, {
                "ok": True,
                "codeDigits": CODE_DIGITS,
                "expiresMs": SESSION_TTL_MS,
            }, send_body)
            return

        if method == "GET" and path == "/network":
            self.send_json(HTTPStatus.OK, {
                "ok": True,
                "host": self.server.server_address[0],
                "port": port,
                "interfaces": interface_entries(port),
            }, send_body)
            return

        if method == "POST" and path == "/offers":
            body = self.read_json()
            offer = body.get("offer")
            if not offer:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "缺少 offer"}, send_body)
                return
            code = create_code()
            sessions[code] = {
                "offer": offer,
                "answer": None,
                "createdAt": now_ms(),
            }
            self.send_json(HTTPStatus.OK, {
                "code": code,
                "expiresAt": now_ms() + SESSION_TTL_MS,
                "url": f"http://{self.headers.get('Host')}{APP_PATH}?mode=receive&code={code}",
            }, send_body)
            return

        if method == "GET" and path.startswith("/offers/"):
            code = path.rsplit("/", 1)[-1]
            cleanup_sessions()
            resolved_code = resolve_code(code)
            session = sessions.get(resolved_code or "")
            if not session:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "发起码不存在或已过期"}, send_body)
                return
            self.send_json(HTTPStatus.OK, {"offer": session["offer"]}, send_body)
            return

        if path.startswith("/answers/"):
            code = path.rsplit("/", 1)[-1]
            cleanup_sessions()
            resolved_code = resolve_code(code)
            session = sessions.get(resolved_code or "")
            if not session:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "发起码不存在或已过期"}, send_body)
                return

            if method == "POST":
                body = self.read_json()
                answer = body.get("answer")
                if not answer:
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "缺少 answer"}, send_body)
                    return
                session["answer"] = answer
                self.send_json(HTTPStatus.OK, {"ok": True}, send_body)
                return

            if method == "GET":
                answer = session.get("answer")
                self.send_json(HTTPStatus.OK, (
                    {"ready": True, "answer": answer}
                    if answer
                    else {"ready": False}
                ), send_body)
                return

        self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"}, send_body)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the tiny LAN Transfer local client.")
    parser.add_argument("--port", type=int, default=5181, help="listen port, default: 5181")
    parser.add_argument("--host", default="0.0.0.0", help="listen host, default: 0.0.0.0")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    mimetypes.add_type("text/javascript; charset=utf-8", ".js")
    mimetypes.add_type("text/javascript; charset=utf-8", ".mjs")

    server = ThreadingHTTPServer((args.host, args.port), LanTransferHandler)
    server.lan_port = args.port

    local_url = f"http://127.0.0.1:{args.port}{APP_PATH}"
    print("LAN Transfer local client is running.")
    print(f"Desktop URL: {local_url}")

    urls = [entry["url"] for entry in interface_entries(args.port)]
    if urls:
        print("Open one of these URLs from other devices on the same LAN:")
        for url in urls:
            print(f"  {url}")
    else:
        print("No LAN address detected. Check Wi-Fi/Ethernet, then retry.")

    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

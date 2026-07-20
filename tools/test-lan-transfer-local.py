#!/usr/bin/env python3
"""Regression tests for the tiny LAN Transfer local client."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("lan-transfer-local.py")
SPEC = importlib.util.spec_from_file_location("lan_transfer_local", SCRIPT_PATH)
assert SPEC and SPEC.loader
lan_transfer_local = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lan_transfer_local)


class LanTransferLocalTests(unittest.TestCase):
    def setUp(self) -> None:
        lan_transfer_local.sessions.clear()

    def tearDown(self) -> None:
        lan_transfer_local.sessions.clear()

    def test_resolve_code_accepts_shortened_leading_zero_code(self) -> None:
        lan_transfer_local.sessions["0032"] = {
            "offer": {"type": "offer"},
            "answer": None,
            "createdAt": lan_transfer_local.now_ms(),
        }

        self.assertEqual(lan_transfer_local.resolve_code("0032"), "0032")
        self.assertEqual(lan_transfer_local.resolve_code("32"), "0032")
        self.assertEqual(lan_transfer_local.resolve_code("032"), "0032")

    def test_resolve_code_rejects_missing_code(self) -> None:
        self.assertIsNone(lan_transfer_local.resolve_code("9999"))


if __name__ == "__main__":
    unittest.main()

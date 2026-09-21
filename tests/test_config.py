import unittest
from unittest.mock import patch

from server.config import _parse_members
from server.mcp_handler import dispatch_tool


class MemberConfigTests(unittest.TestCase):
    def test_parses_arbitrary_member_names(self):
        self.assertEqual(
            _parse_members('{"成员一":"token-a","Archive Bot":"token-b"}'),
            {"成员一": "token-a", "Archive Bot": "token-b"},
        )

    def test_rejects_duplicate_tokens(self):
        with self.assertRaises(RuntimeError):
            _parse_members('{"成员一":"same","成员二":"same"}')

    def test_rejects_reserved_admin_name(self):
        with self.assertRaises(RuntimeError):
            _parse_members('{"admin":"token"}')


class McpFilterTests(unittest.TestCase):
    @patch("server.mcp_handler.db.list_diaries")
    def test_read_diary_forwards_filters(self, list_diaries):
        list_diaries.return_value = {"items": [], "total": 0}

        result = dispatch_tool(
            "read_diary",
            {"author": "成员一", "mood": "quiet", "search": "雨", "limit": 5},
            "成员一",
        )

        self.assertEqual(result, {"items": [], "total": 0})
        list_diaries.assert_called_once_with(
            author="成员一", mood="quiet", search="雨", limit=5, offset=0
        )


if __name__ == "__main__":
    unittest.main()

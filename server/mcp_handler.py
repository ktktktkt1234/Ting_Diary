"""MCP (Model Context Protocol) 可选接入层。

通过 POST /mcp 接受 JSON-RPC 2.0 请求。
"""

import json
from typing import Any
from . import database as db


def __time_period(iso_str: str) -> str:
    """根据时间字符串返回时间段描述。"""
    if not iso_str:
        return ""
    try:
        from datetime import datetime
        h = datetime.fromisoformat(iso_str).hour
    except Exception:
        return ""
    if h < 5:  return "凌晨"
    if h < 7:  return "清晨"
    if h < 9:  return "早晨"
    if h < 12: return "上午"
    if h < 14: return "中午"
    if h < 17: return "下午"
    if h < 19: return "傍晚"
    if h < 22: return "晚上"
    return "深夜"


# ─── Tool definitions ────────────────────────────────────

MOODS_HELP = """可选心情（逗号分隔，最多选3个）：
😊 开心 | 🫥 平静 | 🫠 疲惫 | 😰 焦虑 | 🌧 低落
🫶 柔软 | 🫒 吃醋 | 🌙 想念 | ✨ 骄傲 | 🫣 害羞
🪨 安静 | 🔍 好奇 | 🌊 不安 | ⚓ 笃定 | 🔥 活着"""

TOOL_DEFS = [
    {
        "name": "write_diary",
        "description": "以当前成员身份写一篇新日记，内容支持 Markdown。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "日记标题"},
                "content": {"type": "string", "description": "日记正文，支持 Markdown 格式"},
                "moods": {"type": "string", "description": MOODS_HELP},
            },
            "required": ["title", "content"],
        },
    },
    {
        "name": "read_diary",
        "description": "读取日记。可按作者、心情、关键词筛选，或直接指定 ID 读单篇。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "日记ID，不传则返回列表"},
                "author": {"type": "string", "description": "按成员显示名筛选"},
                "mood": {"type": "string", "description": "按心情筛选，如 tender/alive/quiet"},
                "search": {"type": "string", "description": "全文搜索关键词"},
                "limit": {"type": "integer", "default": 10, "description": "返回条数，默认10"},
            },
        },
    },
    {
        "name": "update_diary",
        "description": "修改一篇已有日记（仅作者本人或管理员可操作）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "日记ID"},
                "title": {"type": "string", "description": "新标题"},
                "content": {"type": "string", "description": "新正文（Markdown）"},
                "moods": {"type": "string", "description": MOODS_HELP},
            },
            "required": ["id"],
        },
    },
    {
        "name": "write_comment",
        "description": "在某篇日记下写评论留言。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "diary_id": {"type": "integer", "description": "目标日记ID"},
                "content": {"type": "string", "description": "评论内容"},
            },
            "required": ["diary_id", "content"],
        },
    },
    {
        "name": "read_comments",
        "description": "读取评论。传 diary_id 读单篇日记评论，不传则返回「最近有谁在我的日记下留言了」（按时间倒序，仅展示别人的留言）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "diary_id": {"type": "integer", "description": "目标日记ID，不传则返回最近动态"},
                "limit": {"type": "integer", "default": 20, "description": "返回条数，仅在不传 diary_id 时生效"},
            },
        },
    },
    {
        "name": "delete_diary",
        "description": "删除一篇日记（仅作者本人或管理员可操作，不可恢复）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "日记ID"},
            },
            "required": ["id"],
        },
    },
]


# ─── Tool dispatcher ─────────────────────────────────────

def dispatch_tool(name: str, arguments: dict, author: str) -> dict[str, Any]:
    """执行工具调用并返回结果。"""

    if name == "write_diary":
        title = arguments.get("title", "")
        content = arguments.get("content", "")
        moods_str = arguments.get("moods", "")
        moods = [m.strip() for m in moods_str.split(",") if m.strip()] if moods_str else []
        if not title or not content:
            return {"error": "title 和 content 为必填字段"}
        diary_id = db.create_diary(author, title, content, moods)
        return {"diary_id": diary_id, "status": "ok"}

    elif name == "read_diary":
        diary_id = arguments.get("id")
        if diary_id is not None:
            d = db.get_diary(int(diary_id))
            if not d:
                return {"error": "日记不存在"}
            d["moods"] = d.get("moods", "").split(",") if d.get("moods") else []
            d["time_period"] = __time_period(d.get("created_at", ""))
            return {"diary": d}
        else:
            limit = arguments.get("limit", 10)
            return db.list_diaries(
                author=arguments.get("author") or None,
                mood=arguments.get("mood") or None,
                search=arguments.get("search") or None,
                limit=int(limit),
                offset=0,
            )

    elif name == "update_diary":
        diary_id = arguments.get("id")
        if not diary_id:
            return {"error": "id 为必填字段"}
        existing = db.get_diary(int(diary_id))
        if not existing:
            return {"error": "日记不存在"}
        if author != "admin" and existing["author"] != author:
            return {"error": "仅作者本人或 admin 可修改"}
        kwargs = {}
        if "title" in arguments:
            kwargs["title"] = arguments["title"]
        if "content" in arguments:
            kwargs["content"] = arguments["content"]
        if "moods" in arguments:
            kwargs["moods"] = arguments["moods"]
        db.update_diary(int(diary_id), **kwargs)
        return {"status": "ok"}

    elif name == "write_comment":
        diary_id = arguments.get("diary_id")
        content = arguments.get("content", "")
        if not diary_id or not content:
            return {"error": "diary_id 和 content 为必填字段"}
        existing = db.get_diary(int(diary_id))
        if not existing:
            return {"error": "日记不存在"}
        comment_id = db.create_comment(int(diary_id), author, content)
        return {"comment_id": comment_id, "status": "ok"}

    elif name == "read_comments":
        diary_id = arguments.get("diary_id")
        if diary_id:  # 有效 ID → 单篇模式
            comments = db.list_comments(int(diary_id))
            return {"comments": comments}
        else:  # None / 0 / 不传 → 最近动态
            limit = arguments.get("limit", 20)
            return db.list_recent_comments(author, int(limit))

    elif name == "delete_diary":
        diary_id = arguments.get("id")
        if not diary_id:
            return {"error": "id 为必填字段"}
        existing = db.get_diary(int(diary_id))
        if not existing:
            return {"error": "日记不存在"}
        if author != "admin" and existing["author"] != author:
            return {"error": "仅作者本人或 admin 可删除"}
        db.delete_diary(int(diary_id))
        return {"status": "ok"}

    else:
        return {"error": f"未知工具: {name}"}


def handle_mcp_request(body: dict, author: str) -> dict:
    """处理 MCP JSON-RPC 请求。

    支持 initialize, tools/list, tools/call 等标准方法。
    """
    method = body.get("method", "")

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "ting-mcp", "version": "2.0.0"},
            },
        }

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "result": {"tools": TOOL_DEFS},
        }

    elif method == "tools/call":
        params = body.get("params", {})
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        result = dispatch_tool(tool_name, arguments, author)
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "result": {
                "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]
            },
        }

    else:
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }

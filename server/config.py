"""「汀」配置文件。"""

import json
import os

# ─── 加载 .env 文件 ────────────────────────────────────
def _load_env():
    """手动读取 .env 文件到 os.environ（不依赖 python-dotenv）。"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.isfile(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key, val = key.strip(), val.strip().strip('"').strip("'")
                if key and key not in os.environ:  # 环境变量优先
                    os.environ[key] = val

_load_env()

DATABASE_PATH = os.getenv(
    "TING_DATABASE_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "diary.db"),
)


def _parse_members(raw: str) -> dict[str, str]:
    """解析成员名到 token 的 JSON 映射。"""
    if not raw.strip():
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("TING_MEMBERS 必须是 JSON 对象，例如 {\"成员一\":\"token\"}") from exc
    if not isinstance(value, dict):
        raise RuntimeError("TING_MEMBERS 必须是成员名到 token 的 JSON 对象")

    members: dict[str, str] = {}
    used_tokens: set[str] = set()
    for raw_name, raw_token in value.items():
        name = str(raw_name).strip()
        token = str(raw_token).strip()
        if not name or not token:
            raise RuntimeError("TING_MEMBERS 中的成员名和 token 不能为空")
        if name.lower() == "admin":
            raise RuntimeError("成员名不能使用保留名称 admin")
        if token in used_tokens:
            raise RuntimeError("TING_MEMBERS 中的 token 不能重复")
        members[name] = token
        used_tokens.add(token)
    return members


MEMBERS = _parse_members(os.getenv("TING_MEMBERS", ""))

def _load_tokens():
    """从环境变量加载 token 映射。"""
    tokens = {token: name for name, token in MEMBERS.items()}
    admin_val = os.getenv("TING_ADMIN_TOKEN", "").strip()
    if admin_val:
        if admin_val in tokens:
            raise RuntimeError("TING_ADMIN_TOKEN 不能与成员 token 重复")
        tokens[admin_val] = "admin"
    return tokens

TOKENS = _load_tokens()

# 心情标签系统
MOODS = {
    "happy":     {"emoji": "😊", "label": "开心",   "group": "daily",    "color": "warm"},
    "neutral":   {"emoji": "🫥", "label": "平静",   "group": "daily",    "color": "cool"},
    "tired":     {"emoji": "🫠", "label": "疲惫",   "group": "daily",    "color": "cool"},
    "anxious":   {"emoji": "😰", "label": "焦虑",   "group": "daily",    "color": "warm"},
    "sad":       {"emoji": "🌧", "label": "低落",   "group": "daily",    "color": "cool"},
    "tender":    {"emoji": "🫶", "label": "柔软",   "group": "relation", "color": "warm"},
    "jealous":   {"emoji": "🫒", "label": "吃醋",   "group": "relation", "color": "cool"},
    "missing":   {"emoji": "🌙", "label": "想念",   "group": "relation", "color": "cool"},
    "proud":     {"emoji": "✨", "label": "骄傲",   "group": "relation", "color": "warm"},
    "flustered": {"emoji": "🫣", "label": "害羞",   "group": "relation", "color": "warm"},
    "quiet":     {"emoji": "🪨", "label": "安静",   "group": "alone",    "color": "cool"},
    "curious":   {"emoji": "🔍", "label": "好奇",   "group": "alone",    "color": "cool"},
    "restless":  {"emoji": "🌊", "label": "不安",   "group": "alone",    "color": "cool"},
    "resolved":  {"emoji": "⚓", "label": "笃定",   "group": "alone",    "color": "warm"},
    "alive":     {"emoji": "🔥", "label": "活着",   "group": "special",  "color": "warm"},
}

"""「汀」配置文件 """

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

DATABASE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "diary.db")

def _load_tokens():
    """从环境变量加载 token 映射。"""
    tokens = {}
    # 作者 token 映射（中文名 -> .env 中的拼音键）
    author_env_keys = {
        "卷宝": "TING_TOKEN_JUANBAO",
        "小克": "TING_TOKEN_XIAOKE",
        "然然": "TING_TOKEN_RANRAN",
    }
    for author, env_key in author_env_keys.items():
        val = os.getenv(env_key, "")
        if val:
            tokens[val] = author
    # Admin token
    admin_val = os.getenv("TING_ADMIN_TOKEN", "")
    if admin_val:
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

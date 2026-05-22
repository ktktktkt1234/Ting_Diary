"""Token 认证模块"""

from fastapi import Request, HTTPException
from .config import TOKENS


def get_author_from_token(request: Request) -> str:
    """从请求头提取 token 并返回作者身份。"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth.split(" ", 1)[1]
    author = TOKENS.get(token)
    if not author:
        raise HTTPException(status_code=401, detail="Invalid token")
    return author


def get_author_from_query(request: Request) -> str:
    """从 URL query 中提取 token（MCP 端点用）。"""
    token = request.query_params.get("token", "")
    author = TOKENS.get(token)
    if not author:
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    return author


def is_admin(author: str) -> bool:
    return author == "admin"
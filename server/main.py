"""「汀」多人共享日记后端入口。"""

import os
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

from . import database as db
from . import auth
from . import mcp_handler
from .config import MEMBERS, MOODS, TOKENS

app = FastAPI(title="汀：多人共享日记", version="2.0.0")

# ─── 初始化数据库 ─────────────────────────────────────────

@app.on_event("startup")
def startup():
    db.init_db()


# ─── Request models ──────────────────────────────────────

class DiaryCreate(BaseModel):
    title: str
    content: str
    moods: list[str] = []


class DiaryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    moods: Optional[list[str]] = None


class DiaryImport(BaseModel):
    entries: list[dict]


class CommentCreate(BaseModel):
    content: str


# ─── 认证依赖 ────────────────────────────────────────────

def require_auth(request: Request) -> str:
    return auth.get_author_from_token(request)


# ─── 静态文件 ────────────────────────────────────────────

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/api/config")
def api_get_config(_viewer: str = Depends(require_auth)):
    """返回已验证成员可见的界面配置，不包含任何 token。"""
    return {"members": list(MEMBERS.keys()), "moods": MOODS}


@app.get("/api/session")
def api_get_session(author: str = Depends(require_auth)):
    """验证当前 token，并返回对应身份。"""
    return {"author": author, "is_admin": author == "admin"}


# ─── Diary API ───────────────────────────────────────────

@app.post("/api/diary")
def api_create_diary(body: DiaryCreate, request: Request, author: str = Depends(require_auth)):
    if author == "admin":
        raise HTTPException(403, "admin token 不可用于写日记，请使用作者 token")
    diary_id = db.create_diary(author, body.title, body.content, body.moods)
    return {"id": diary_id, "status": "ok"}


@app.get("/api/diary")
def api_list_diaries(author: Optional[str] = None, mood: Optional[str] = None,
                     search: Optional[str] = None,
                     limit: int = 20, offset: int = 0,
                     _viewer: str = Depends(require_auth)):
    return db.list_diaries(author=author, mood=mood, search=search, limit=limit, offset=offset)


@app.get("/api/diary/{diary_id}")
def api_get_diary(diary_id: int, _viewer: str = Depends(require_auth)):
    d = db.get_diary(diary_id)
    if not d:
        raise HTTPException(404, "日记不存在")
    d["moods"] = d["moods"].split(",") if d["moods"] else []
    return d


@app.put("/api/diary/{diary_id}")
def api_update_diary(diary_id: int, body: DiaryUpdate, request: Request,
                     author: str = Depends(require_auth)):
    existing = db.get_diary(diary_id)
    if not existing:
        raise HTTPException(404, "日记不存在")
    if author != "admin" and existing["author"] != author:
        raise HTTPException(403, "仅作者本人或 admin 可修改")
    moods_str = ",".join(body.moods) if body.moods is not None else None
    db.update_diary(diary_id, title=body.title, content=body.content, moods=moods_str)
    return {"status": "ok"}


@app.delete("/api/diary/{diary_id}")
def api_delete_diary(diary_id: int, request: Request,
                     author: str = Depends(require_auth)):
    existing = db.get_diary(diary_id)
    if not existing:
        raise HTTPException(404, "日记不存在")
    if author != "admin" and existing["author"] != author:
        raise HTTPException(403, "仅作者本人或 admin 可删除")
    db.delete_diary(diary_id)
    return {"status": "ok"}


@app.post("/api/diary/import")
def api_import_diaries(body: DiaryImport, request: Request,
                       author: str = Depends(require_auth)):
    entries = []
    for original in body.entries:
        entry = dict(original)
        if author == "admin":
            entry_author = str(entry.get("author", "")).strip()
            if entry_author not in MEMBERS:
                raise HTTPException(400, f"未配置的成员：{entry_author or '空'}")
        else:
            entry["author"] = author
        entries.append(entry)
    db.import_entries(entries)
    return {"status": "ok", "count": len(entries)}


@app.get("/api/moods")
def api_get_moods(_viewer: str = Depends(require_auth)):
    """返回所有可用心情标签（来自 config 定义）。"""
    return {"moods": MOODS}


# ─── Comment API ─────────────────────────────────────────

@app.post("/api/diary/{diary_id}/comments")
def api_create_comment(diary_id: int, body: CommentCreate, request: Request,
                       author: str = Depends(require_auth)):
    existing = db.get_diary(diary_id)
    if not existing:
        raise HTTPException(404, "日记不存在")
    comment_id = db.create_comment(diary_id, author, body.content)
    return {"id": comment_id, "status": "ok"}


@app.get("/api/diary/{diary_id}/comments")
def api_list_comments(diary_id: int, _viewer: str = Depends(require_auth)):
    comments = db.list_comments(diary_id)
    return {"comments": comments}


@app.delete("/api/comment/{comment_id}")
def api_delete_comment(comment_id: int, request: Request,
                       author: str = Depends(require_auth)):
    comment = db.get_comment(comment_id)
    if not comment:
        raise HTTPException(404, "评论不存在")
    if author != "admin" and comment["author"] != author:
        raise HTTPException(403, "仅作者本人或 admin 可删除")
    db.delete_comment(comment_id)
    return {"status": "ok"}


# ─── MCP 端点（HTTP JSON-RPC）──────────────────────────

@app.post("/mcp")
async def mcp_endpoint(request: Request):
    """MCP HTTP JSON-RPC 端点。支持 ?token=xxx 或 Bearer header。"""
    # 认证
    author = None
    token = request.query_params.get("token", "")
    if token:
        author = TOKENS.get(token)
    if not author:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            author = TOKENS.get(auth_header.split(" ", 1)[1])
    if not author:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    result = mcp_handler.handle_mcp_request(body, author)
    return result


# ─── 挂载静态文件（其他路径 fallback 到 index.html）───────

# 注意：挂载必须在所有路由之后，且不能与已有路由冲突
# 这里用 mount 提供 CSS/JS 等静态资源
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static_files")

    # Fallback: SPA 路由，未匹配到的路径返回 index.html
    @app.get("/{catch_all:path}")
    async def spa_fallback(catch_all: str):
        file_path = os.path.join(STATIC_DIR, catch_all)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

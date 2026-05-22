"""SQLite 数据库操作"""

import sqlite3
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from .config import DATABASE_PATH

# 北京时间 (UTC+8)
CN_TZ = timezone(timedelta(hours=8))

def now_cn() -> str:
    return datetime.now(CN_TZ).isoformat()

os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """初始化表结构。"""
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS diary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                moods TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS comment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                diary_id INTEGER NOT NULL,
                author TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (diary_id) REFERENCES diary(id) ON DELETE CASCADE
            );
        """)


# ─── Diary CRUD ──────────────────────────────────────────

def create_diary(author: str, title: str, content: str, moods: list[str] | None = None,
                 created_at: str | None = None) -> int:
    moods_str = ",".join(moods) if moods else ""
    ts = created_at or now_cn()
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO diary (author, title, content, moods, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (author, title, content, moods_str, ts, ts))
        return cur.lastrowid


def list_diaries(author: str | None = None, mood: str | None = None,
                 search: str | None = None,
                 limit: int = 20, offset: int = 0):
    with get_conn() as conn:
        conditions = []
        params = []

        if author:
            conditions.append("author=?")
            params.append(author)
        if mood:
            conditions.append("moods LIKE ?")
            params.append(f"%{mood}%")
        if search:
            conditions.append("(title LIKE ? OR content LIKE ?)")
            params.append(f"%{search}%")
            params.append(f"%{search}%")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        count_where = where

        rows = conn.execute(
            f"SELECT id, author, title, moods, created_at, substr(content,1,100) AS preview "
            f"FROM diary {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset]).fetchall()
        total = conn.execute(f"SELECT COUNT(*) FROM diary {count_where}", params).fetchone()[0]

    return {
        "items": [dict(r) for r in rows],
        "total": total
    }


def get_diary(diary_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM diary WHERE id=?", (diary_id,)).fetchone()
    return dict(row) if row else None


def update_diary(diary_id: int, title: str | None = None,
                 content: str | None = None, moods: str | None = None,
                 author: str | None = None):
    with get_conn() as conn:
        fields = []
        values = []
        if title is not None:
            fields.append("title=?")
            values.append(title)
        if content is not None:
            fields.append("content=?")
            values.append(content)
        if moods is not None:
            fields.append("moods=?")
            values.append(moods)
        if author is not None:
            fields.append("author=?")
            values.append(author)
        if not fields:
            return
        fields.append("updated_at=?")
        values.append(now_cn())
        values.append(diary_id)
        conn.execute(f"UPDATE diary SET {','.join(fields)} WHERE id=?", values)


def delete_diary(diary_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM diary WHERE id=?", (diary_id,))


def import_entries(entries: list[dict]):
    """批量导入日记，保留原始 created_at。"""
    with get_conn() as conn:
        for e in entries:
            moods_str = ",".join(e.get("moods", [])) if isinstance(e.get("moods"), list) else e.get("moods", "")
            created = e.get("created_at", now_cn())
            conn.execute(
                "INSERT INTO diary (author, title, content, moods, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                (e["author"], e["title"], e["content"], moods_str, created, created))


def get_all_moods() -> list[str]:
    """从已有日记中收集所有出现过的 mood。"""
    with get_conn() as conn:
        rows = conn.execute("SELECT DISTINCT moods FROM diary WHERE moods != ''").fetchall()
    mood_set = set()
    for r in rows:
        for m in r["moods"].split(","):
            m = m.strip()
            if m:
                mood_set.add(m)
    return sorted(mood_set)


# ─── Comment CRUD ────────────────────────────────────────

def create_comment(diary_id: int, author: str, content: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO comment (diary_id, author, content, created_at) VALUES (?,?,?,?)",
            (diary_id, author, content, now_cn()))
        return cur.lastrowid


def list_comments(diary_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, diary_id, author, content, created_at FROM comment WHERE diary_id=? ORDER BY created_at ASC",
            (diary_id,)).fetchall()
    return [dict(r) for r in rows]


def delete_comment(comment_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM comment WHERE id=?", (comment_id,))
        return cur.rowcount > 0


def get_comment(comment_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM comment WHERE id=?", (comment_id,)).fetchone()
    return dict(row) if row else None


def list_recent_comments(author: str, limit: int = 20) -> dict:
    """返回与 author 相关的最近评论（别人在作者日记下的留言）。"""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT c.id, c.diary_id, d.title AS diary_title,
                      c.author, c.content, c.created_at
               FROM comment c
               JOIN diary d ON c.diary_id = d.id
               WHERE d.author = ? AND c.author != ?
               ORDER BY c.created_at DESC
               LIMIT ?""",
            (author, author, limit)
        ).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) FROM comment c JOIN diary d ON c.diary_id = d.id WHERE d.author = ? AND c.author != ?",
            (author, author)
        ).fetchone()[0]
    return {
        "comments": [dict(r) for r in rows],
        "total": total,
    }
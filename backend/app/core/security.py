"""Password hashing and signed tokens (separate secret from the current system)."""
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings

ALGO = "HS256"


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()


def check_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode(), hashed.encode())
    except ValueError:
        return False


def make_token(subject: str, kind: str, expires: timedelta | datetime) -> str:
    exp = expires if isinstance(expires, datetime) else datetime.now(UTC) + expires
    return jwt.encode({"sub": subject, "kind": kind, "exp": exp}, settings.JWT_SECRET, algorithm=ALGO)


def read_token(token: str, kind: str) -> str | None:
    try:
        data = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        return None
    return data.get("sub") if data.get("kind") == kind else None

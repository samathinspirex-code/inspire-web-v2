from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import check_password, make_token, read_token
from app.modules.admin_auth.models import AdminUser

router = APIRouter(prefix="/api/v1/admin/auth", tags=["admin auth"])


class LoginIn(BaseModel):
    email: str
    password: str


async def current_admin(authorization: str = Header(default=""), db: AsyncSession = Depends(get_db)) -> AdminUser:
    token = authorization.removeprefix("Bearer ").strip()
    uid = read_token(token, "admin") if token else None
    user = await db.get(AdminUser, int(uid)) if uid and uid.isdigit() else None
    if not user or not user.is_active:
        raise HTTPException(401, "Please sign in")
    return user


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(AdminUser).where(AdminUser.email == body.email.strip().lower()))).scalar_one_or_none()
    if not user or not user.is_active or not check_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return {
        "token": make_token(str(user.id), "admin", timedelta(hours=settings.ADMIN_TOKEN_HOURS)),
        "user": {"email": user.email, "name": user.full_name},
    }


@router.get("/me")
async def me(user: AdminUser = Depends(current_admin)):
    return {"email": user.email, "name": user.full_name}

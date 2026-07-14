"""
JWT auth (spec §1). Validates the SAME gen-taxi-backend token: payload { id,
role, ... }, no issuer. Provides FastAPI dependencies for role scoping.
"""
from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException, status

from app.config import get_settings


@dataclass
class Principal:
    user_id: str
    role: str
    city_zone: str | None = None


def _decode(token: str) -> Principal:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.PyJWTError as exc:  # noqa: PERF203
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    user_id = payload.get("id") or payload.get("sub")
    role = payload.get("role")
    if not user_id or role not in ("passenger", "driver", "admin"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Malformed token")
    return Principal(user_id=user_id, role=role, city_zone=payload.get("city_zone"))


async def current_user(authorization: str = Header(default="")) -> Principal:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    return _decode(authorization.split(" ", 1)[1])


def require_role(*roles: str):
    async def _dep(user: Principal = Depends(current_user)) -> Principal:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user

    return _dep

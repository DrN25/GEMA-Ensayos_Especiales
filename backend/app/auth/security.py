import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt


ISSUER = "gema-especiales"
AUDIENCE = "gema-especiales-api"
ALGORITHM = "HS256"


def signing_key() -> str:
    key = os.environ.get("JWT_SECRET_KEY", "").strip()
    if not key:
        raise RuntimeError("Configura JWT_SECRET_KEY para Ensayos Especiales.")
    return key


def hash_password(password: str) -> str:
    encoded = password.strip().encode("utf-8")
    if len(password.strip()) < 4 or len(encoded) > 72:
        raise ValueError("La contraseña debe tener al menos 4 caracteres y ocupar hasta 72 bytes.")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, UnicodeError):
        return False


def create_token(user_id: int, version: int) -> str:
    try:
        minutes = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
        if minutes <= 0:
            raise ValueError
        now = datetime.now(timezone.utc)
        expires = now + timedelta(minutes=minutes)
    except (ValueError, OverflowError) as exc:
        raise RuntimeError("Configura ACCESS_TOKEN_EXPIRE_MINUTES con un entero positivo.") from exc

    return jwt.encode(
        {"sub": str(user_id), "ver": version, "iss": ISSUER, "aud": AUDIENCE, "iat": now, "exp": expires},
        signing_key(), algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token, signing_key(), algorithms=[ALGORITHM], issuer=ISSUER, audience=AUDIENCE,
            options={"require_sub": True, "require_exp": True, "require_iat": True,
                     "require_iss": True, "require_aud": True},
        )
    except (JWTError, RuntimeError):
        return None

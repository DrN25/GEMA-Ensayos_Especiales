from datetime import datetime, timezone
from typing import Literal
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.models import SYSTEM_CODE, Role, System, User
from app.auth.security import create_token, decode_token, hash_password, signing_key, verify_password
from app.database import get_db


bearer = HTTPBearer(auto_error=False)
auth = APIRouter(prefix="/api/auth", tags=["Autenticación"])


class LoginInput(BaseModel):
    username_or_email: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=72)


class PasswordInput(BaseModel):
    old_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=1, max_length=72)


class UserInput(BaseModel):
    usuario: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=1, max_length=200)
    nombre_completo: str | None = Field(default=None, max_length=150)
    rol_id: int
    password: str | None = Field(default=None, max_length=72)


class StatusInput(BaseModel):
    estado: Literal["A", "I", "*"]


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def scoped_users():
    return select(User).join(User.rol).join(System, User.sistema_id == System.id).where(
        System.codigo == SYSTEM_CODE, System.estado == "A"
    )


def session_error():
    return HTTPException(401, "Sesión inválida o expirada.", headers={"WWW-Authenticate": "Bearer"})


def db_session_error():
    return HTTPException(503, "La base de datos de cuentas no está disponible.")


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise session_error()
    payload = decode_token(credentials.credentials)
    if not payload:
        raise session_error()
    subject, version = payload["sub"], payload.get("ver")
    if not isinstance(subject, str) or not re.fullmatch(r"[0-9]{1,10}", subject) or not 0 < int(subject) <= 2147483647 or type(version) is not int:
        raise session_error()
    try:
        user = db.scalar(scoped_users().where(
            User.id == int(subject), User.estado == "A", Role.estado == "A", User.version_seguridad == version
        ))
    except SQLAlchemyError as exc:
        raise db_session_error() from exc
    if user is None:
        raise session_error()
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.rol.nombre != "admin":
        raise HTTPException(403, "La gestión de cuentas requiere un administrador.")
    return user


admin = APIRouter(prefix="/api/admin", tags=["Gestión de usuarios"], dependencies=[Depends(require_admin)])


def profile(user: User):
    return {
        "usuario_id": user.id, "usuario": user.usuario, "email": user.email,
        "nombre_completo": user.nombre_completo, "rol_id": user.rol_id, "rol_nombre": user.rol.nombre,
        "estado": user.estado, "protegido": user.protegido, "ultimo_acceso": user.ultimo_acceso,
    }


def password_hash(value: str):
    try:
        return hash_password(value)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


def commit(db: Session):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "El usuario ya existe o el correo está registrado en este sistema.") from exc


@auth.post("/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    try:
        signing_key()
    except RuntimeError as exc:
        raise HTTPException(503, "La sesión aún no está configurada.") from exc
    identifier = data.username_or_email.strip()
    candidates = scoped_users().where(User.estado == "A", Role.estado == "A")
    try:
        user = db.scalar(candidates.where(User.usuario == identifier.upper()))
        if user is None:
            user = db.scalar(candidates.where(User.email == identifier.lower()))
    except SQLAlchemyError as exc:
        raise db_session_error() from exc
    if user is None or not verify_password(data.password, user.contrasena_hash):
        raise HTTPException(401, "Credenciales incorrectas o cuenta inactiva para Ensayos Especiales.")
    try:
        token = create_token(user.id, user.version_seguridad)
    except RuntimeError as exc:
        raise HTTPException(503, "La sesión aún no está configurada.") from exc
    user.ultimo_acceso = now()
    result = profile(user)
    commit(db)
    return {"access_token": token, "token_type": "bearer", "user": result}


@auth.get("/me")
def me(user: User = Depends(current_user)):
    return profile(user)


def update_account(db: Session, user: User, actor: User, values: dict, revoke: bool):
    changes = {**values, "fecha_modificacion": now(), "usuario_modificacion": actor.usuario}
    if revoke:
        changes["version_seguridad"] = User.version_seguridad + 1
    try:
        result = db.execute(update(User).where(
            User.id == user.id, User.sistema_id == actor.sistema_id,
            User.version_seguridad == user.version_seguridad,
        ).values(**changes).execution_options(synchronize_session=False))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "La cuenta cambió. Actualiza la vista y vuelve a intentar.")
        commit(db)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "El usuario ya existe o el correo está registrado en este sistema.") from exc


@auth.post("/change-password")
def change_password(data: PasswordInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not verify_password(data.old_password, user.contrasena_hash):
        raise HTTPException(400, "La contraseña actual ingresada no es correcta.")
    update_account(db, user, user, {"contrasena_hash": password_hash(data.new_password)}, revoke=True)
    return {"message": "Contraseña actualizada."}


@auth.post("/logout", status_code=204)
def logout(db: Session = Depends(get_db), user: User = Depends(current_user)):
    update_account(db, user, user, {}, revoke=True)


def active_role(db: Session, actor: User, role_id: int) -> Role:
    role = db.scalar(select(Role).where(Role.id == role_id, Role.sistema_id == actor.sistema_id, Role.estado == "A"))
    if role is None:
        raise HTTPException(422, "Selecciona un rol activo de Ensayos Especiales.")
    return role


def target_user(db: Session, user_id: int) -> User:
    user = db.scalar(scoped_users().where(User.id == user_id))
    if user is None:
        raise HTTPException(404, "Usuario no encontrado.")
    return user


def normalize_identity(data: UserInput):
    username = data.usuario.strip().upper()
    email = data.email.strip().lower()
    if not re.fullmatch(r"[^\s@]{1,50}", username) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(email) > 200:
        raise HTTPException(422, "Ingresa un nombre de usuario sin espacios y un correo válido.")
    return username, email, (data.nombre_completo or "").strip() or None


@admin.get("/roles")
def list_roles(db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    roles = db.scalars(select(Role).where(Role.sistema_id == actor.sistema_id, Role.estado == "A").order_by(Role.nombre))
    return [{"rol_id": role.id, "nombre": role.nombre} for role in roles]


@admin.get("/usuarios")
def list_users(db: Session = Depends(get_db)):
    return [profile(user) for user in db.scalars(scoped_users().order_by(User.usuario))]


@admin.post("/usuarios", status_code=201)
def create_user(data: UserInput, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    username, email, name = normalize_identity(data)
    role = active_role(db, actor, data.rol_id)
    user = User(
        sistema_id=actor.sistema_id, usuario=username, email=email, nombre_completo=name,
        contrasena_hash=password_hash(data.password or ""), rol=role, estado="A",
        fecha_registro=now(), usuario_registro=actor.usuario,
    )
    db.add(user)
    commit(db)
    return profile(user)


@admin.put("/usuarios/{user_id}")
def edit_user(user_id: int, data: UserInput, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    user = target_user(db, user_id)
    username, email, name = normalize_identity(data)
    password = data.password is not None
    if user.protegido and (password or (username, email, data.rol_id) != (user.usuario, user.email, user.rol_id)):
        raise HTTPException(403, "La cuenta protegida solo puede cambiar su contraseña desde su perfil.")
    if actor.id == user.id and data.rol_id != user.rol_id:
        raise HTTPException(403, "No puedes cambiar tu propio rol.")
    role = active_role(db, actor, data.rol_id)
    values = {"usuario": username, "email": email, "nombre_completo": name, "rol_id": role.id}
    if password:
        values["contrasena_hash"] = password_hash(data.password)
    update_account(db, user, actor, values, revoke=password or (role.id, username, email) != (user.rol_id, user.usuario, user.email))
    return profile(target_user(db, user_id))


@admin.patch("/usuarios/{user_id}/estado")
def change_status(user_id: int, data: StatusInput, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    user = target_user(db, user_id)
    if data.estado != "A" and (user.protegido or actor.id == user.id):
        raise HTTPException(403, "Esta cuenta no se puede desactivar ni dar de baja.")
    if user.estado != data.estado:
        update_account(db, user, actor, {"estado": data.estado}, revoke=True)
    return profile(target_user(db, user_id))

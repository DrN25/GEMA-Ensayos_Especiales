from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, ForeignKeyConstraint, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


SYSTEM_CODE = "especiales"


class AuthBase(DeclarativeBase):
    """Map the shared tables without adding them to the application's auto-create metadata."""


class System(AuthBase):
    __tablename__ = "Sistemas"
    __table_args__ = {"schema": "auth"}

    id: Mapped[int] = mapped_column("SistemaID", Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column("Codigo", String(50), unique=True)
    nombre: Mapped[str] = mapped_column("Nombre", String(100))
    estado: Mapped[str] = mapped_column("Estado", String(1))


class Role(AuthBase):
    __tablename__ = "Roles"
    __table_args__ = (
        UniqueConstraint("SistemaID", "RolID"),
        UniqueConstraint("SistemaID", "Nombre"),
        {"schema": "auth"},
    )

    id: Mapped[int] = mapped_column("RolID", Integer, primary_key=True)
    sistema_id: Mapped[int] = mapped_column("SistemaID", ForeignKey("auth.Sistemas.SistemaID"))
    nombre: Mapped[str] = mapped_column("Nombre", String(50))
    descripcion: Mapped[str | None] = mapped_column("Descripcion", String(200))
    estado: Mapped[str] = mapped_column("Estado", String(1))
    protegido: Mapped[bool] = mapped_column("EsProtegido", Boolean, default=False)


class User(AuthBase):
    __tablename__ = "Usuarios"
    __table_args__ = (
        UniqueConstraint("SistemaID", "Email"),
        ForeignKeyConstraint(["SistemaID", "RolID"], ["auth.Roles.SistemaID", "auth.Roles.RolID"]),
        {"schema": "auth"},
    )

    id: Mapped[int] = mapped_column("UsuarioID", Integer, primary_key=True)
    sistema_id: Mapped[int] = mapped_column("SistemaID", Integer)
    usuario: Mapped[str] = mapped_column("Usuario", String(50), unique=True)
    email: Mapped[str] = mapped_column("Email", String(200))
    contrasena_hash: Mapped[str] = mapped_column("ContrasenaHash", String(255))
    nombre_completo: Mapped[str | None] = mapped_column("NombreCompleto", String(150))
    rol_id: Mapped[int] = mapped_column("RolID", Integer)
    estado: Mapped[str] = mapped_column("Estado", String(1))
    protegido: Mapped[bool] = mapped_column("EsProtegido", Boolean, default=False)
    version_seguridad: Mapped[int] = mapped_column("VersionSeguridad", Integer, default=0)
    ultimo_acceso: Mapped[datetime | None] = mapped_column("UltimoAcceso", DateTime)
    fecha_registro: Mapped[datetime] = mapped_column("FechaRegistro", DateTime)
    usuario_registro: Mapped[str | None] = mapped_column("UsuarioRegistro", String(100))
    fecha_modificacion: Mapped[datetime | None] = mapped_column("FechaModificacion", DateTime)
    usuario_modificacion: Mapped[str | None] = mapped_column("UsuarioModificacion", String(100))

    rol: Mapped[Role] = relationship(lazy="joined", innerjoin=True)

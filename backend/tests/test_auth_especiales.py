from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth.models import AuthBase, Role, System, User
from app.auth.security import hash_password
from app.database import get_db
from app.main import app


@pytest.fixture
def account_client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "isolated-test-key-for-especiales")
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def prepare_schema(connection, _):
        connection.execute("ATTACH DATABASE ':memory:' AS auth")
        connection.execute("PRAGMA foreign_keys = ON")

    AuthBase.metadata.create_all(engine)
    hashed = hash_password("initial-password")
    with Session(engine) as db:
        db.add_all([
            System(id=1, codigo="mapeo", nombre="Mapeo", estado="A"),
            System(id=2, codigo="especiales", nombre="Especiales", estado="A"),
        ])
        db.flush()
        roles = [
            Role(id=1, sistema_id=1, nombre="admin", estado="A"),
            Role(id=2, sistema_id=2, nombre="admin", estado="A", protegido=True),
            Role(id=3, sistema_id=2, nombre="usuario", estado="A"),
        ]
        db.add_all(roles)
        db.flush()
        db.add_all(
            User(id=i, sistema_id=role.sistema_id, usuario=username, email=email, rol=role, estado="A",
                 protegido=i == 2, contrasena_hash=hashed, fecha_registro=datetime.now())
            for i, role, username, email in [
                (1, roles[0], "ADMIN_MAPEO", "admin@example.com"),
                (2, roles[1], "ADMIN_ESPECIALES", "admin@example.com"),
                (3, roles[2], "TEST_ESPECIALES", "test@example.com"),
            ]
        )
        db.commit()

    def override():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = override
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def login(client, identifier, password="initial-password"):
    return client.post("/api/auth/login", json={"username_or_email": identifier, "password": password})


def bearer(response):
    assert response.status_code == 200, response.text
    data = response.json()
    assert "contrasena_hash" not in data["user"]
    return {"Authorization": "Bearer " + data["access_token"]}


def test_scoped_login_and_api_gate(account_client):
    client = account_client
    for path in ["/api/ensayos", "/api/proyectos", "/api/auditoria/history", "/api/uploads/test.xlsx", "/api/db-status"]:
        assert client.get(path).status_code == 401
    assert client.post("/api/records/bulk", json=[]).status_code == 401
    assert client.get("/api/health").status_code == 200
    assert login(client, "ADMIN_MAPEO").status_code == 401
    response = login(client, "admin@example.com")
    headers = bearer(response)
    assert client.get("/api/auth/me", headers=headers).json()["usuario"] == "ADMIN_ESPECIALES"
    foreign_token = jwt.encode({
        "sub": "2", "ver": 0, "iss": "gema-mapeo", "aud": "gema-mapeo-api",
        "iat": datetime.now(timezone.utc), "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }, "isolated-test-key-for-especiales", algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {foreign_token}"}).status_code == 401
    operational = bearer(login(client, "test_especiales"))
    assert client.get("/api/config/columnas", headers=operational).status_code == 200
    assert client.get("/api/admin/usuarios", headers=operational).status_code == 403


def test_manage_accounts_and_keep_first_admin_protected(account_client):
    client = account_client
    admin = bearer(login(client, "ADMIN_ESPECIALES"))
    assert {user["usuario"] for user in client.get("/api/admin/usuarios", headers=admin).json()} == {
        "ADMIN_ESPECIALES", "TEST_ESPECIALES"
    }
    assert client.patch("/api/admin/usuarios/2/estado", headers=admin, json={"estado": "I"}).status_code == 403
    assert client.patch("/api/admin/usuarios/1/estado", headers=admin, json={"estado": "I"}).status_code == 404
    data = {"usuario": "NUEVO_ESPECIALES", "email": "nuevo@example.com", "rol_id": 1, "password": "temp-123"}
    assert client.post("/api/admin/usuarios", headers=admin, json=data).status_code == 422
    data["rol_id"] = 3
    created = client.post("/api/admin/usuarios", headers=admin, json=data)
    assert created.status_code == 201, created.text
    assert client.post("/api/admin/usuarios", headers=admin, json=data).status_code == 409
    user_id = created.json()["usuario_id"]
    token = bearer(login(client, "NUEVO_ESPECIALES", "temp-123"))
    edited = client.put(f"/api/admin/usuarios/{user_id}", headers=admin, json={
        **data, "nombre_completo": "Cuenta de prueba", "password": "other-123",
    })
    assert edited.status_code == 200, edited.text
    assert edited.json()["nombre_completo"] == "Cuenta de prueba"
    assert client.get("/api/auth/me", headers=token).status_code == 401
    token = bearer(login(client, "NUEVO_ESPECIALES", "other-123"))
    assert client.patch(f"/api/admin/usuarios/{user_id}/estado", headers=admin, json={"estado": "I"}).status_code == 200
    assert client.get("/api/auth/me", headers=token).status_code == 401
    assert login(client, "NUEVO_ESPECIALES", "other-123").status_code == 401


def test_password_change_and_logout_revoke_session(account_client):
    client = account_client
    headers = bearer(login(client, "ADMIN_ESPECIALES"))
    assert client.post("/api/auth/change-password", headers=headers, json={
        "old_password": "incorrect", "new_password": "other-password",
    }).status_code == 400
    assert client.post("/api/auth/change-password", headers=headers, json={
        "old_password": "initial-password", "new_password": "other-password",
    }).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert login(client, "ADMIN_ESPECIALES").status_code == 401
    headers = bearer(login(client, "ADMIN_ESPECIALES", "other-password"))
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401

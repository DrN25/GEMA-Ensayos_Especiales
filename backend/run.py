# -*- coding: utf-8 -*-
import os
import uvicorn

def load_dotenv():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, ".env"),
        ".env",
        "../.env",
        "app/.env"
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        parts = line.split("=", 1)
                        if len(parts) == 2:
                            key, val = parts[0].strip(), parts[1].strip()
                            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                                val = val[1:-1]
                            if key not in os.environ:
                                os.environ[key] = val
            break

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv()

    # Validar conexión al arranque
    try:
        from app.database import engine
        from sqlalchemy import text, inspect
        print("Verificando conexión a la Base de Datos (SQL Server)...")
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            inspector = inspect(engine)
            if inspector.has_table("registro_maestro"):
                print("✓ Tabla 'registro_maestro' accesible.")
            if inspector.has_table("proyecto"):
                print("✓ Tabla 'proyecto' accesible.")
        print("Conexión verificada con éxito.")
    except Exception as e:
        print(f"Error al conectar con la base de datos: {e}")
        print("El servidor intentará continuar...")

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8002"))
    print(f"Iniciando el servidor Uvicorn en http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)

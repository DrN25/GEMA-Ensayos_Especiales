import os
import urllib.parse
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base

def load_dotenv():
    for path in [".env", "../.env", "app/.env"]:
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

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

engine = None
connect_args = {}

# Verificar y crear base de datos SQL Server si es necesario
def verify_and_create_db(driver, server, db_name, trusted, user, password):
    try:
        import pyodbc
        if trusted:
            conn_str = f"DRIVER={{{driver}}};SERVER={server};DATABASE=master;Trusted_Connection=yes;"
        else:
            conn_str = f"DRIVER={{{driver}}};SERVER={server};DATABASE=master;UID={user};PWD={password};"
            
        if "Driver 18" in driver:
            conn_str += "TrustServerCertificate=yes;"
            
        print(f"Auto-Heal: Conectando a {server} (master) para verificar existencia de '{db_name}'...")
        conn = pyodbc.connect(conn_str, autocommit=True)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sys.databases WHERE name = ?", db_name)
        row = cursor.fetchone()
        if not row:
            print(f"Auto-Heal: La base de datos '{db_name}' no existe en {server}. Creándola automáticamente...")
            cursor.execute(f"CREATE DATABASE [{db_name}]")
            print(f"Auto-Heal: Base de datos '{db_name}' creada con éxito.")
        else:
            print(f"Auto-Heal: Confirmado, la base de datos '{db_name}' ya existe.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Auto-Heal Advertencia: No se pudo verificar/crear la base de datos desde 'master': {e}")

# Inyección inteligente y migración automática de columnas y tablas maestras
def auto_heal_schema(active_engine):
    try:
        from sqlalchemy import Integer, Float, String
        db_inspector = inspect(active_engine)
        
        # 1. Crear tabla de Proyectos si no existe
        if not db_inspector.has_table("proyecto"):
            print("Auto-Heal Schema: Creando tabla de Proyectos...")
            with active_engine.begin() as connection:
                if "sqlite" in str(active_engine.url):
                    connection.execute(text("""
                        CREATE TABLE proyecto (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            nombre VARCHAR(100) NOT NULL UNIQUE,
                            sinonimos VARCHAR(500) NULL
                        )
                    """))
                else:
                    connection.execute(text("""
                        CREATE TABLE proyecto (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            nombre VARCHAR(100) NOT NULL UNIQUE,
                            sinonimos VARCHAR(500) NULL
                        )
                    """))
            print("Auto-Heal Schema: Tabla Proyecto creada con éxito.")

        # 2. Rellenar proyectos por defecto si está vacía
        with active_engine.begin() as connection:
            count = connection.execute(text("SELECT COUNT(*) FROM proyecto")).scalar()
            if count == 0:
                print("Auto-Heal Schema: Poblando tabla de Proyectos con valores por defecto...")
                connection.execute(text("INSERT INTO proyecto (nombre, sinonimos) VALUES ('CHABB', 'CHABB, CH-ABB, PROYECTO ABB')"))
                connection.execute(text("INSERT INTO proyecto (nombre, sinonimos) VALUES ('CHG25', 'CHG25, CH-G25, CAMPANIA 2025')"))
                connection.execute(text("INSERT INTO proyecto (nombre, sinonimos) VALUES ('UNI', 'UNI, UNIVERSIDAD, LABORATORIO UNI')"))

        # 3. Validar columnas faltantes en RegistroMaestro
        if db_inspector.has_table("registro_maestro"):
            existing_cols = {col['name'].lower() for col in db_inspector.get_columns("registro_maestro")}
            
            # --- IMPORTACIÓN DIRECTA POR CONTROL SEGURO ---
            import sys
            models = sys.modules.get("app.models")
            if not models:
                from app import models
            # -----------------------------------------------------------------

            model_cols = models.RegistroMaestro.__table__.columns
            
            with active_engine.begin() as connection:
                for col in model_cols:
                    col_name_lower = col.name.lower()
                    if col_name_lower not in existing_cols:
                        col_type_str = ""
                        if isinstance(col.type, Integer):
                            col_type_str = "INT"
                        elif isinstance(col.type, Float):
                            col_type_str = "FLOAT"
                        elif isinstance(col.type, String):
                            length = col.type.length or 255
                            col_type_str = f"VARCHAR({length})"
                        else:
                            col_type_str = "VARCHAR(255)"
                        
                        if "sqlite" in str(connection.engine.url):
                            query = f"ALTER TABLE registro_maestro ADD COLUMN {col.name} {col_type_str}"
                        else:
                            query = f"ALTER TABLE registro_maestro ADD {col.name} {col_type_str}"
                            
                        print(f"Auto-Heal Schema: Añadiendo columna faltante en BD: '{col.name}' ({col_type_str})...")
                        connection.execute(text(query))
                        print(f"Auto-Heal Schema: Columna '{col.name}' inyectada con éxito.")
    except Exception as e:
        print(f"Auto-Heal Error: Falló la re-sincronización de columnas: {e}")

# 1. Probar DATABASE_URL primero si está configurado
if DATABASE_URL:
    try:
        if "sqlite" in DATABASE_URL:
            connect_args = {"check_same_thread": False}
        engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"Conexión exitosa usando DATABASE_URL.")
    except Exception as e:
        print(f"Error al conectar usando DATABASE_URL: {e}")
        engine = None

# 2. Si no hay DATABASE_URL o falló, intentar conexión por defecto con SQL Server
if not engine:
    db_server = os.environ.get("DB_SERVER", "localhost\\SQLEXPRESS")
    db_name = os.environ.get("DB_NAME", "ensayos_especiales")
    db_trusted = os.environ.get("DB_TRUSTED", "yes").lower() == "yes"
    db_user = os.environ.get("DB_USER", "")
    db_password = os.environ.get("DB_PASSWORD", "")
    
    drivers_to_try = [
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 18 for SQL Server",
        os.environ.get("DB_DRIVER", "SQL Server")
    ]
    
    for driver in drivers_to_try:
        try:
            verify_and_create_db(driver, db_server, db_name, db_trusted, db_user, db_password)
            if db_trusted:
                conn_str = f"DRIVER={{{driver}}};SERVER={db_server};DATABASE={db_name};Trusted_Connection=yes;"
            else:
                conn_str = f"DRIVER={{{driver}}};SERVER={db_server};DATABASE={db_name};UID={db_user};PWD={db_password};"
            
            if "Driver 18" in driver:
                conn_str += "TrustServerCertificate=yes;"
                
            params = urllib.parse.quote_plus(conn_str)
            url = f"mssql+pyodbc:///?odbc_connect={params}"
            
            temp_engine = create_engine(url, pool_pre_ping=True)
            with temp_engine.connect() as conn:
                conn.execute(text("SELECT 1 WHERE :x = :y"), {"x": "test", "y": "test"})
            
            engine = temp_engine
            DATABASE_URL = url
            print(f"Conexión exitosa a SQL Server '{db_server}', BD '{db_name}' usando driver: '{driver}'.")
            break
        except Exception as e:
            print(f"No se pudo establecer conexión a SQL Server con el driver '{driver}': {e}")

# 3. Fallback SQLite
if not engine:
    sqlite_path = os.path.join(os.path.dirname(__file__), "ensayos_especiales.db")
    DATABASE_URL = f"sqlite:///{sqlite_path}"
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
    print(f"ADVERTENCIA: Fallaron las conexiones a SQL Server. Cayendo en base de datos SQLite local: '{sqlite_path}'")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
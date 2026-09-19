# -*- coding: utf-8 -*-
import uvicorn
import os

if __name__ == "__main__":
    # Iniciar servidor FastAPI en el puerto 8002 de forma asíncrona
    port = int(os.environ.get("PORT", 8002))
    print(f"Iniciando el servidor Uvicorn en http://localhost:{port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)

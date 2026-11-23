# Activación de cuentas de Ensayos Especiales

Ensayos Especiales usa el código `especiales` en el esquema compartido `auth`. El script registra el sistema, los roles `admin` y `usuario`, y la primera cuenta protegida `ADMIN_ESPECIALES`. Las tablas de permisos permanecen disponibles para una fase posterior. Una cuenta activa puede usar los módulos de trabajo, y la gestión de cuentas requiere el rol `admin` de este sistema.

## Prueba local en Windows

1. Abre PowerShell en `backend`. Instala las dependencias en tu entorno virtual.

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

2. Genera un hash bcrypt para la cuenta inicial. El comando solicita la contraseña de forma interactiva.

   ```powershell
   .\.venv\Scripts\python.exe -c "from getpass import getpass; from app.auth.security import hash_password; print(hash_password(getpass('Contrasena de ADMIN_ESPECIALES: ')))"
   ```

3. En SSMS, abre `001_auth_ensayos_especiales.sql` y selecciona la **copia local** de la base compartida. En la ventana de consulta, completa `@AdminEmail` y pega el resultado del paso anterior en `@AdminHash`. Ejecuta el script completo. La consulta final confirma el sistema, el rol y el estado de la cuenta. Mantén el archivo versionado con ambos valores vacíos. Volver a ejecutar el script conserva la cuenta protegida y su contraseña.
4. Genera una clave de firma y guarda el resultado como `JWT_SECRET_KEY` en el archivo `backend/.env` local, junto con la configuración de SQL Server existente.

   ```powershell
   .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   La sesión dura 24 horas por defecto. Se puede cambiar con `ACCESS_TOKEN_EXPIRE_MINUTES`.

5. Arranca el backend y el frontend en terminales separadas.

   ```powershell
   Set-Location 'C:\PROYECTO-GEMA\ESPECIALES\GEMA-Ensayos_Especiales\backend'
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload
   ```

   ```powershell
   Set-Location 'C:\PROYECTO-GEMA\ESPECIALES\GEMA-Ensayos_Especiales\frontend'
   npm.cmd run dev
   ```

6. Entra a `http://127.0.0.1:5175` con `ADMIN_ESPECIALES`. Desde **Gestión de usuarios**, crea una cuenta con rol `usuario` y comprueba que puede usar Resumen, Registro Maestro y Registro de Ensayos. En el perfil verifica el cambio de contraseña y el cierre de sesión. Ambos invalidan las sesiones vigentes de esa cuenta.

Si había cambios pendientes de la grilla guardados por una versión anterior al inicio de sesión, sincronízalos antes de actualizar. Los borradores de la nueva versión usan claves por cuenta.

## Render y Netlify

1. Antes de publicar la actualización de `master`, ejecuta en SSMS el mismo script sobre la base compartida de producción. Genera una contraseña exclusiva de producción, usa el correo autorizado y revisa el resultado del script. El script requiere que la migración de autenticación de Mapeo y Logueo ya esté aplicada.
2. Configura `JWT_SECRET_KEY` en **Render** con una clave nueva y distinta de las de desarrollo, Mapeo y Logueo. Conserva las variables de conexión a SQL Server. La cuenta SQL de Render necesita lectura de `auth.Sistemas` y `auth.Roles`, y lectura, inserción y actualización de `auth.Usuarios`.
3. Verifica en **Netlify** que `VITE_API_BASE` siga apuntando a la URL HTTPS del backend de Ensayos Especiales en Render. Las dependencias de firma y bcrypt se instalan desde `backend/requirements.txt` al desplegar el backend. Publica backend y frontend desde el mismo cambio de `master`.
4. Una vez desplegados ambos servicios, verifica `/api/health` y prueba el inicio de sesión, el panel de cuentas, la navegación y el cierre de sesión. Los clientes externos que consuman endpoints de negocio necesitarán enviar el encabezado `Authorization: Bearer <token>`.


## Ejecutor, Supervisor y firmas comunes en reportes

La actualización `004_reporte_ejecutor_supervisor.sql` corresponde a los reportes
de todos los tipos de ensayo, con o sin fotografías.

1. Detén el backend local para no mezclar código anterior y nuevo durante la prueba.
2. En SSMS conecta a **localhost**, selecciona la copia local `db_ad0a4f_gema` y
   abre `004_reporte_ejecutor_supervisor.sql`.
3. Ejecuta todo el archivo. Requiere `002_reporte_ensayo.sql` ya aplicado. La consulta
   final debe mostrar `ejecutor` y `supervisor` como `nvarchar` de 300 bytes (150
   caracteres), además del valor predeterminado de la columna antigua `muestreo`.
4. El script es idempotente, no elimina registros y no altera Registro Maestro,
   imágenes ni autenticación. Conserva `muestreo` por compatibilidad; la aplicación
   nueva ya no lo envía ni lo consulta.
5. Reinicia backend y frontend con los comandos habituales. En Reportes, completa
   **Ejecutor** y **Supervisor** dentro de Datos y revisa vista previa, guardado y
   descarga del historial en UCS, Corte directo, Triaxial, Tracción y Elásticas.
6. Ambas firmas deben aparecer centradas, con los nombres ingresados y los textos
   «Ejecutor del Ensayo» y «Supervisor de Laboratorio». En UCS comprueba también
   la emisión con fotografías: las firmas deben aparecer una sola vez debajo.

La limpieza de reportes de prueba sigue siendo opcional y es independiente de esta
actualización. No se ejecutó SQL Server durante el desarrollo. En un futuro despliegue,
el responsable debe aplicar esta migración en la BD de producción antes de activar
el backend actualizado; no se ejecuta automáticamente al iniciar la aplicación.
No cambian las variables de Google Drive, JWT ni frontend.

# Fotografías UCS en Google Drive — configuración y pruebas locales

## Alcance

Google Drive almacena las fotografías opcionales de los cinco tipos de reportes:
UCS, Corte directo, Compresión triaxial, Tracción indirecta y Determinación de
constantes elásticas. Este documento conserva su nombre histórico IMAGENES_UCS.md,
pero su configuración es común a todos ellos.

`comunes/fotos.html` y `comunes/fotos.css` contienen el formato fotográfico aprobado:
marcos adaptados a la proporción, altura común, separación de 20 mm y padding de
1.5 mm. La base del reporte incluye las fotografías una sola vez, antes de las
firmas comunes. Sin fotografías no se muestran marcos ni rótulos.

La selección de carpeta depende de **tipo_ensayo**, nunca de las letras del código:
Constantes elásticas puede tener UCS en codigo_muestra y sigue usando su carpeta
propia. Cada reporte conserva su plantilla, versión y columnas de resultados.
Las firmas ahora utilizan texto de 7 pt, interlineado 1.15 y nombres sin altura
mínima artificial, para reducir el espacio entre el nombre y el cargo.

Esta ampliación no agrega tablas ni columnas. Reutiliza las migraciones 002, 003 y
004 ya aplicadas y la autorización OAuth existente, sin cambiar .env ni credenciales.
No se han ejecutado operaciones contra SQL Server, Drive ni R2 durante el desarrollo.

## Comportamiento

- Seleccionar una imagen solo la optimiza en el navegador; no se envía a Drive.
- La vista previa usa esas imágenes locales. El backend recibe únicamente sus
  dimensiones para calcular los marcos; no guarda archivos ni metadatos.
- **Guardar reporte** inicia la carga de Antes y Después y luego confirma la
  emisión en SQL. Son opcionales como pareja: ninguna foto, o las dos con igual
  orientación. Se conservan JPEG/PNG originales hasta 10 MiB como entrada; solo
  se transmite y conserva el JPEG optimizado, máximo 1600 px y 1 MiB por fotografía.
- El PDF se genera y descarga en el navegador. El backend no almacena PDF.
- El historial usa la instantánea emitida y recupera las fotografías privadas
  mediante GEMA. El usuario no necesita entrar a Google desde el formulario.
- Si una carga falla, la emisión no se confirma. Un reintento usa el mismo ID de
  solicitud y un ID de Drive reservado antes de cargar, evitando duplicados por
  pérdida de respuesta. Pueden quedar imágenes pendientes si se abandona el
  formulario después de pulsar Guardar; hay limpieza manual para esos casos.
- Si la emisión se confirma y falla la descarga del PDF, se recupera del historial.
- Editar campos/fotografías después de una operación fallida inicia otra solicitud;
  las imágenes de la solicitud abandonada pueden quedar como candidatas de limpieza.

## 1. Preparar Google Cloud con tu cuenta personal

Configuración local con **Mi unidad y OAuth**, no cuenta de servicio.

1. Entra a https://console.cloud.google.com/ con tu cuenta de pruebas.
2. Crea/selecciona un proyecto, por ejemplo `GEMA Especiales Local`.
3. En **APIs y servicios > Biblioteca**, busca **Google Drive API** y habilítala.
4. En **Google Auth Platform**, configura los datos de la aplicación (Branding):
   nombre, correo de soporte y contacto del desarrollador.
5. En **Audience / Público**, selecciona **External / Externo**, deja el proyecto
   en **Testing / Prueba** para esta primera evaluación y agrega tu correo como
   usuario de prueba.
6. En **Data Access / Acceso a los datos**, agrega únicamente el alcance
   `https://www.googleapis.com/auth/drive.file`.
7. En **Clients / Clientes**, crea un cliente OAuth de tipo **Desktop app /
   Aplicación de escritorio**, por ejemplo `Configuración local GEMA`.
8. Descarga su JSON. No crees una clave API ni credenciales de cuenta de servicio.
   No compartas el JSON ni sus contenidos por chat o GitHub.

`drive.file` autoriza archivos creados por esta aplicación o compartidos expresamente
con ella. Para evitar pedir acceso a todo tu Drive o agregar un selector de Google,
el asistente crea una carpeta nueva dentro de Mi unidad. Puedes cambiarle el nombre
posteriormente. No copies el ID de una carpeta cualquiera: el alcance puede impedir
que la aplicación acceda a ella.

Fuentes oficiales:
- https://developers.google.com/workspace/guides/configure-oauth-consent
- https://developers.google.com/workspace/guides/create-credentials
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth

## 2. Instalar dependencias y ubicar el JSON

Detén el backend y usa **PowerShell**:

```powershell
Set-Location 'C:\PROYECTO-GEMA\ESPECIALES\GEMA-Ensayos_Especiales\backend'
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
New-Item -ItemType Directory -Force -Path '.secrets' | Out-Null
```

Mueve el JSON descargado a:

```text
C:\PROYECTO-GEMA\ESPECIALES\GEMA-Ensayos_Especiales\backend\.secrets\google-drive-client.json
```

`.secrets` está excluido de Git y Docker. También se excluyen los nombres habituales
de credenciales y tokens. Mantén esos archivos únicamente en tu equipo de pruebas.

## 3. Autorizar la cuenta y crear la carpeta

Desde la misma carpeta `backend`:

```powershell
.\.venv\Scripts\python.exe -m app.reportes.setup_google_drive --client '.secrets\google-drive-client.json'
```

El asistente abre el navegador. Selecciona la misma cuenta agregada como usuario de
prueba, verifica el nombre de tu aplicación y concede el permiso de Drive solicitado.
La respuesta se recibe mediante una dirección temporal de loopback en tu PC; no
necesitas registrar la URL de tu frontend ni iniciar el backend para este paso.

El asistente genera:

- `.secrets/google-drive-token.json`: autorización privada; contiene secretos.
- `.secrets/google-drive-config.txt`: las dos variables que hay que copiar al backend.
- Carpeta en Mi unidad: **GEMA - Ensayos Especiales - LOCAL**.

Al guardar el primer reporte con fotografías de cada tipo se crea su subcarpeta
correspondiente. Las carpetas existentes se reutilizan mediante su identificador.
Puedes compartir la carpeta raíz con quienes revisarán las fotos, preferentemente
como lectores. La aplicación no publica archivos ni comparte enlaces automáticamente.

Las carpetas se crean bajo la misma raíz configurada:

| Tipo de ensayo | Subcarpeta |
|---|---|
| UCS | UCS |
| Determinación de constantes elásticas | Constantes elásticas |
| Compresión triaxial | Compresión triaxial |
| Corte directo | Corte directo |
| Tracción indirecta | Tracción indirecta |

Ejemplo de nombres dentro de la carpeta del ensayo:

```text
FEGT20-001-CD-M01_ANTES_<fechaUTC>_<id>.jpg
FEGT20-001-CD-M01_DESPUES_<fechaUTC>_<id>.jpg
```

El nombre combina muestra, posición, fecha/hora UTC e identificador. El nombre
original de la imagen no se conserva. El ID del archivo es la referencia estable;
no se busca por nombre para descargar. Renombrar la foto no rompe el reporte.
Moverla dentro del Drive accesible conserva la referencia, pero no elimina la
necesidad de que la cuenta de la aplicación mantenga acceso al archivo.

## 4. Configurar el backend

Abre tú mismo `backend/.env`. Conserva las variables actuales de SQL y autenticación.
Agrega las dos líneas de `.secrets/google-drive-config.txt`:

```dotenv
GOOGLE_DRIVE_TOKEN_FILE=C:/PROYECTO-GEMA/ESPECIALES/GEMA-Ensayos_Especiales/backend/.secrets/google-drive-token.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=ID_REAL_GENERADO_POR_EL_ASISTENTE
```

No pongas estas variables ni credenciales en `frontend/.env.local`. El frontend no
requiere cambios de configuración. Las variables `R2_*` ya no se utilizan y pueden
quitarse de tu configuración local cuando confirmes las pruebas de Drive.

Se puede usar el ejemplo `backend/.env.drive.example` como referencia. Reinicia el
backend después de cambiar las variables o renovar el archivo de autorización,
porque el cliente de almacenamiento se conserva en memoria durante el proceso.

## 5. Base de datos y limpieza de pruebas anteriores

No hay cambios de esquema necesarios si ya ejecutaste
`backend/migrations/003_reporte_imagenes.sql` para las pruebas anteriores.
Para el cambio de firmantes de noviembre de 2026, aplicar también
`backend/migrations/004_reporte_ejecutor_supervisor.sql` sobre la copia local antes
de reiniciar el backend. Agrega Ejecutor y Supervisor a la tabla del reporte;
no modifica el almacenamiento de fotografías ni requiere otra autorización Google.

La tabla `dbo.reporte_ensayo_imagen` conserva sus columnas:

| Columna | Contenido con Google Drive |
|---|---|
| proveedor | `google_drive` |
| bucket | ID de la carpeta del tipo de ensayo |
| objeto | ID del archivo de Drive |
| id_imagen | UUID de la fotografía, derivado de solicitud, usuario y posición |
| sha256 | Huella del JPEG optimizado para detectar modificaciones posteriores |
| bytes / ancho / alto | Tamaño y dimensiones verificadas |
| id_reporte | Referencia a la emisión confirmada |

SQL guarda solo metadatos e instantáneas, nunca bytes de imagen, base64 ni PDF.

Como el historial anterior era de prueba, hay un script **opcional y manual**:
`backend/scripts/limpiar_reportes_pruebas_local.sql`.

1. Abre SSMS y conecta expresamente a tu SQL Server local y a `db_ad0a4f_gema`.
2. Abre el script y ejecútalo tal como está: solo muestra servidor y cantidades.
3. Si confirmas que quieres borrar todo el historial LOCAL de reportes, copia el
   valor mostrado de `MachineName` a `@EquipoLocal` y cambia `@EliminarPruebas` a `1`.
4. Ejecútalo de nuevo. Elimina referencias de imágenes y reportes en una transacción.
   No toca `registro_maestro`, autenticación ni otras tablas; no reinicia identidades.

**No ejecutar esa limpieza en producción.** No es una migración necesaria para
Google Drive. No se han borrado datos automáticamente. Los archivos de prueba
antiguos en R2 no se migran ni se borran con este script; puedes eliminarlos después,
revisando tu bucket de pruebas, cuando termines de validar Drive.

Los reportes antiguos con referencias R2 muestran un aviso de incompatibilidad,
no intentan acceder al almacenamiento anterior. Las plantillas/versiones emitidas
sin R2 conservan su resolución; no se cambian las versiones de otros tipos de ensayo.

## 6. Ejecutar el proyecto

Backend, en una ventana de PowerShell:

```powershell
Set-Location 'C:\PROYECTO-GEMA\ESPECIALES\GEMA-Ensayos_Especiales\backend'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload
```

Frontend, en otra ventana:

```powershell
Set-Location 'C:\PROYECTO-GEMA\ESPECIALES\GEMA-Ensayos_Especiales\frontend'
npm.cmd run dev
```

Abre http://127.0.0.1:5175. No necesitas autorizar Google cada vez que inicias el
proyecto. El backend renueva el token de acceso automáticamente mientras siga
vigente la autorización de renovación.

## 7. Pruebas manuales

1. Revisa en Drive que la carpeta esté vacía o anota su contenido.
2. En GEMA, selecciona una muestra de cualquiera de los cinco tipos y completa el formulario de reporte.
3. Selecciona Antes y Después. Drive debe seguir sin archivos nuevos.
4. Pulsa Vista previa: ambas imágenes y firmas deben verse; Drive sigue igual.
5. Pulsa Guardar reporte: deben aparecer dos JPEG en la subcarpeta del tipo, con nombres
   reconocibles. La emisión se confirma y el PDF se descarga automáticamente.
6. Comprueba el formato del PDF, abre el historial y vuelve a descargarlo.
7. Reinicia el backend y repite la descarga desde el historial.
8. Prueba emitir otro reporte sin fotografías: no debe crear archivos ni marcos.
9. Prueba una interrupción de red durante el guardado y reintenta sin editar el
   formulario: no debe duplicar las mismas fotografías ni la emisión.
10. Repite con UCS, Corte directo, Triaxial, Tracción y Constantes elásticas. Para
    este último verifica que un código con UCS se guarde en Constantes elásticas.
11. Si compartes la carpeta con otra cuenta, comprueba desde esa cuenta que puede
    revisar las fotografías sin utilizar la aplicación.

Si se elimina una fotografía, se pierde su permiso o se modifica su contenido,
GEMA muestra un error al recuperar el PDF. Se verifica el SHA-256 de la imagen
emitida; un reporte histórico no sustituye silenciosamente sus fotografías por
archivos alterados en Drive. Conviene dar al equipo acceso de lectura para revisión.

## Limitaciones de usar una cuenta personal

- Los archivos pertenecen a esa cuenta y consumen su espacio disponible, compartido
  con otros servicios de Google según el plan de la cuenta.
- Debes compartir expresamente la carpeta con el equipo. Tener acceso a GEMA no
  concede automáticamente acceso a las carpetas de Google Drive.
- Con OAuth **externo + Testing**, Google expide una autorización de renovación
  que normalmente expira a los **7 días** al solicitar permisos de Drive. El token
  de acceso de corta duración se renueva automáticamente, pero al expirar/revocarse
  la autorización de renovación debes volver a ejecutar el asistente.
- Renovar SIN crear otra carpeta:

  ```powershell
  .\.venv\Scripts\python.exe -m app.reportes.setup_google_drive --client '.secrets\google-drive-client.json' --folder-id 'MISMO_GOOGLE_DRIVE_ROOT_FOLDER_ID'
  ```

  Usa la misma cuenta y cliente OAuth. Después reinicia el backend. Conserva el mismo
  ID de carpeta en `.env`; las fotografías anteriores siguen en esa carpeta.
- El modo Testing es apropiado para estas pruebas, no para dejar una integración
  estable desatendida en producción. Publicar la configuración OAuth elimina esa
  condición específica de siete días, pero no vuelve irrevocables los permisos:
  el usuario puede retirarlos y Google puede invalidar la autorización por otras causas.
- No se utiliza cuenta de servicio sobre Mi unidad: esas cuentas no tienen cuota de
  almacenamiento propia ni pueden ser propietarias de archivos.

Fuentes:
- https://developers.google.com/identity/protocols/oauth2#expiration
- https://developers.google.com/identity/protocols/oauth2/native-app
- https://developers.google.com/workspace/drive/api/guides/folder

## Recursos, mantenimiento y futuro despliegue

La API recibe JPEG acotados a 1 MiB. La recepción y lectura trabajan por bloques
con archivo temporal que pasa a disco después de 64 KiB. Como máximo se permiten
2 transferencias de fotografías simultáneas **por proceso**; al superarlo se
responde 429 y se puede reintentar. No se decodifican píxeles en Python ni se generan
PDF en Render. Google admite cargas multipart con metadatos para archivos pequeños;
se envía un archivo cada vez. El consumo total real debe medirse con el monitor.

La limpieza manual de fotografías sin reporte, de más de 24 horas, conserva el modo
simulación por defecto:

```powershell
.\.venv\Scripts\python.exe -m app.reportes.cleanup_images
# Solo si revisaste los candidatos y confirmaste el entorno:
.\.venv\Scripts\python.exe -m app.reportes.cleanup_images --apply
```

`--apply` elimina archivos y filas elegibles del almacenamiento Drive configurado;
no elimina fotos asociadas a reportes, ni objetos R2. Revisa las carpetas ya existentes
de los cinco tipos en la raíz configurada y no crea carpetas durante la limpieza.
SQL y Drive no tienen una
transacción común. Los pendientes y la reserva de IDs permiten recuperar reintentos,
pero necesitan este mantenimiento si se abandona un guardado.

Al decidir el despliegue se debe confirmar la cuenta propietaria y la carpeta de
producción. Una cuenta personal de pruebas no se configura automáticamente en Render.
Las credenciales se cargarían como Secret File, fuera de la imagen Docker, y se
configuraría su ruta mediante `GOOGLE_DRIVE_TOKEN_FILE`. No copiar rutas de Windows
al servidor Linux. Los JSON privados están excluidos del contexto de Docker.

El adaptador utiliza IDs y parámetros compatibles con unidades compartidas, pero
la autorización Workspace/cuenta de servicio se evaluará e implementará cuando se
confirme esa opción. No se asume que baste con cambiar un ID. Para un VPS con la misma
modalidad OAuth se trasladan las credenciales y configuración a un lugar privado;
las fotografías seguirán en Drive, sin depender del disco temporal de Render.

## Archivos y verificaciones

- `image_storage.py`: autenticación OAuth, carpeta por tipo, IDs reservados,
  transferencia acotada y verificación de integridad.
- `images.py`: metadatos y asociación a reportes; sin cambios al esquema existente.
- `router.py`: recepción JPEG autenticada, descarga privada y vista previa local.
- `setup_google_drive.py`: asistente CLI local de autorización; no importa SQL ni `.env`.
- `cleanup_images.py`: mantenimiento manual de archivos huérfanos de todos los tipos.
- `plantillas/comunes/fotos.html` y `fotos.css`: un único bloque fotográfico para todas
  las plantillas; los formatos específicos solo definen sus resultados.
- `frontend/src/features/reports/reportPhotos.ts` y `Reportes.tsx`: separación de
  vista previa local/carga al guardar, y recuperación autenticada desde el historial.
- `.gitignore` y `backend/.dockerignore`: exclusión de credenciales.

Las pruebas automatizadas usan SQLite en memoria y Drive simulado. No sustituyen la
prueba real de autorización/carga de tu cuenta, que requiere los pasos de esta guía.

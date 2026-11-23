# Origen de los campos comunes

El encabezado y las secciones **Datos** y **Datos de muestra** reciben variables de Jinja. Cada reporte corresponde a un solo `codigo_muestra` y reúne los datos de sus corridas y los datos propios de la emisión.

## Proyectos

| Código en `registro_maestro.proyecto` | Nombre visible |
| --- | --- |
| `FRBB` | Ferro |
| `CHABB` | Chalco |
| Pendiente de confirmar | Charcas |

La vista previa usa la correspondencia de `comunes/preparar_campos.py` en el encabezado y en el campo Proyecto. La ubicación se registra por emisión.

## Título del reporte

El encabezado del reporte se muestra como `ENSAYO DE {{ tipo_ensayo }} - {{ texto_titulo }}`. `tipo_ensayo` viene de `registro_maestro.tipo_ensayo`. Para UCS, el texto visible es «Compresión uniaxial». `texto_titulo` es el campo libre de la emisión. Por ejemplo, el usuario puede ingresar `ASTM D2938`. Si el campo libre está vacío, se omite el guion.

## Encabezado y Datos

| Campo visible | Variable | Origen o criterio |
| --- | --- | --- |
| Nombre del proyecto en el encabezado | `nombre_proyecto` | Resolver `registro_maestro.proyecto` según la correspondencia de proyectos. El formato actual muestra «Proyecto Ferro» como ejemplo. |
| Informe N.º | `datos.informe` | Dato propio de la emisión. Usar `reporte_ensayo.numero_informe`. Puede repetirse. |
| Ejecutor | `datos.ejecutor` | Nombre ingresado por el usuario. Se guarda en `reporte_ensayo.ejecutor` y en la instantánea de la emisión. |
| Supervisor | `datos.supervisor` | Nombre ingresado por el usuario. Se guarda en `reporte_ensayo.supervisor` y en la instantánea de la emisión. |
| Proyecto | `datos.proyecto` | Nombre derivado de `registro_maestro.proyecto` según la correspondencia de proyectos. |
| Fecha de emisión | `datos.fecha_emision` | Dato propio de la emisión. Usar `reporte_ensayo.fecha_emision`. |
| Coordenadas | `datos.coordenadas` | Formatear `este`, `norte` y `elevacion`, en ese orden. La plantilla muestra cada valor disponible en una línea. |
| Ubicación | `datos.ubicacion` | Dato propio de la emisión. Usar `reporte_ensayo.ubicacion`. |
| Sector | `datos.sector` | `registro_maestro.sectores`. Puede quedar vacío. En el CSV está vacío en 25 filas. |

## Datos de muestra

| Campo visible | Variable | Origen o criterio |
| --- | --- | --- |
| Material | `muestra.material` | Dato propio de la emisión. Usar `reporte_ensayo.material`. |
| Presentación | `muestra.presentacion` | Dato propio de la emisión. Usar `reporte_ensayo.presentacion`. |
| Muestreado | `muestra.muestreado` | Dato propio de la emisión. Usar `reporte_ensayo.muestreado`. |
| Código | `muestra.codigo` | `registro_maestro.codigo_muestra`. Es la clave de agrupación del ensayo. |
| Sondaje | `muestra.sondaje` | `registro_maestro.sondaje`. |
| Observaciones | `muestra.observaciones` | `registro_maestro.observacion`. Si en un ensayo futuro hay textos distintos por corrida, confirmar si deben aparecer juntos o si se registra una observación general propia. |
| Litología | `muestra.litologia` | Concatenar `registro_maestro.lito1`, `lito2` y `lito3` en ese orden, separados por guion bajo. Se mantienen los valores repetidos. Ejemplo `MZH_MZH_MZH`. |
| Profundidad | `muestra.profundidad` | Dato propio de la emisión. Usar `reporte_ensayo.profundidad` como valor registrado. Su definición, tipo y unidad quedan pendientes de validación. |

## Datos propios de la emisión

Una sola tabla nueva, `dbo.reporte_ensayo`, con un registro por reporte y un solo código de muestra por registro.

| Columna propuesta | Uso |
| --- | --- |
| `id_reporte` | Clave primaria del reporte. |
| `codigo_muestra` | Código requerido para enlazar con las corridas. Usar `varchar(150)`, como en `registro_maestro`. |
| `numero_informe` | Texto visible del informe. Admite números repetidos. |
| `fecha_emision` | Fecha registrada para el reporte. Tipo propuesto `date`. |
| `texto_titulo` | Texto libre que ingresa el usuario para la última parte del título. |
| `ubicacion`, `ejecutor`, `supervisor`, `material`, `presentacion`, `muestreado`, `profundidad` | Datos propios del reporte. |

## Relación con el registro maestro

`dbo.reporte_ensayo.codigo_muestra` enlaza cada reporte con las corridas que tienen ese valor en `dbo.registro_maestro.codigo_muestra`. El esquema exportado usa `idd` como clave primaria y admite varias corridas con el mismo código. Una clave foránea directa a `registro_maestro.codigo_muestra` requeriría que ese código fuera único en la tabla de corridas. [Claves foráneas en SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/tables/create-foreign-key-relationships?view=sql-server-ver17#limitations)

Para mantener una sola tabla nueva, el módulo puede validar que exista al menos una corrida con el código al guardar. Para cargar el reporte, se identifica la emisión por `id_reporte` y se recuperan sus corridas por `codigo_muestra`. El código solo se marcaría como único en la nueva tabla si se acuerda permitir un máximo de un reporte por código.

## Preparación de los valores para la plantilla

- En las 454 corridas revisadas, los campos que vienen de `registro_maestro` son consistentes dentro de cada `codigo_muestra` al comparar cada columna por separado. Si aparecen discrepancias en datos futuros, resolverlas por campo antes de imprimir el informe.
- `comunes/preparar_campos.py` prepara las variables antes de renderizar el HTML. Este, Norte y Elevación aparecen en líneas separadas bajo `datos.coordenadas`. La litología mantiene las posiciones de los niveles vacíos, por ejemplo `TBX__MZH`, y queda en blanco si faltan los tres.
- `tipo_ensayo` permite elegir la plantilla según el tipo de las corridas. La franja del título se arma en la base común.


## Firmas comunes del reporte

`comunes/base-a4.html` incluye una sola vez `comunes/firmas.html` al finalizar los
anexos, para todos los tipos de ensayo. `comunes/firmas.css` define dos columnas
iguales, centradas en un contenedor de hasta 150 mm, con separación de 16 mm.
Se mantiene espacio de 22 mm para firma/sello, texto de 7 pt y línea al 75 %. El interlineado es 1.15, sin la altura mínima
que antes separaba artificialmente el nombre de la segunda línea.

- Izquierda: `datos.ejecutor`, seguido de «Ejecutor del Ensayo».
- Derecha: `datos.supervisor`, seguido de «Supervisor de Laboratorio».

No se obtienen los nombres desde la sesión ni del Registro Maestro: son valores
de la emisión. Se conservan dentro de `datos_emitidos` para descargar el mismo
reporte desde el historial. No hay firmantes fijos ni bloques duplicados en UCS.
Los nombres siguen siendo opcionales, como lo era el campo reemplazado; el usuario
puede completarlos en Datos. Cada nombre admite hasta 150 caracteres Unicode.

La migración manual `backend/migrations/004_reporte_ejecutor_supervisor.sql` agrega
ambas columnas. La antigua `muestreo` permanece solo por compatibilidad, con valor
predeterminado vacío para los INSERT nuevos; no aparece en el formulario ni en el
PDF. No confundirla con `muestreado`, que sigue en Datos de muestra sin cambios.
No se reinterpretan valores antiguos de Muestreo como nombres de personas. Las
instantáneas anteriores sin nombres se pueden abrir, con los espacios de nombre
vacíos. No es obligatorio limpiar el historial.


## Fotografías comunes de todos los ensayos

La base incluye `comunes/fotos.html` después de los anexos y antes de las firmas;
`comunes/fotos.css` aplica el mismo formato aprobado para UCS a los cinco tipos.
No quedan marcos vacíos cuando no se adjuntan fotos. Con fotografías se requiere
la pareja Antes/Después y la misma orientación, con alturas iguales, marcos que
siguen la proporción y separación de 20 mm. La tabla de resultados de cada tipo
se conserva; agregar fotos no transforma el formato en UCS.

El `photo_folder` de cada ReportFormat determina su carpeta de Drive. CE mantiene
su propia carpeta aunque el código de muestra incluya UCS. La vista previa usa
archivos locales; únicamente Guardar reporte inicia la carga. El historial usa
los metadatos de la emisión para recuperar los archivos por ID. Esta ampliación
no requiere modificar el esquema SQL ni reautorizar Google Drive.

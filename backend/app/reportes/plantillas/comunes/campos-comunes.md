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
| Muestreo | `datos.muestreo` | Dato propio de la emisión. Usar `reporte_ensayo.muestreo`. La definición del campo queda pendiente de validar. |
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
| `ubicacion`, `muestreo`, `material`, `presentacion`, `muestreado`, `profundidad` | Datos propios del reporte. |

## Relación con el registro maestro

`dbo.reporte_ensayo.codigo_muestra` enlaza cada reporte con las corridas que tienen ese valor en `dbo.registro_maestro.codigo_muestra`. El esquema exportado usa `idd` como clave primaria y admite varias corridas con el mismo código. Una clave foránea directa a `registro_maestro.codigo_muestra` requeriría que ese código fuera único en la tabla de corridas. [Claves foráneas en SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/tables/create-foreign-key-relationships?view=sql-server-ver17#limitations)

Para mantener una sola tabla nueva, el módulo puede validar que exista al menos una corrida con el código al guardar. Para cargar el reporte, se identifica la emisión por `id_reporte` y se recuperan sus corridas por `codigo_muestra`. El código solo se marcaría como único en la nueva tabla si se acuerda permitir un máximo de un reporte por código.

## Preparación de los valores para la plantilla

- En las 454 corridas revisadas, los campos que vienen de `registro_maestro` son consistentes dentro de cada `codigo_muestra` al comparar cada columna por separado. Si aparecen discrepancias en datos futuros, resolverlas por campo antes de imprimir el informe.
- `comunes/preparar_campos.py` prepara las variables antes de renderizar el HTML. Este, Norte y Elevación aparecen en líneas separadas bajo `datos.coordenadas`. La litología mantiene las posiciones de los niveles vacíos, por ejemplo `TBX__MZH`, y queda en blanco si faltan los tres.
- `tipo_ensayo` permite elegir la plantilla según el tipo de las corridas. La franja del título se arma en la base común.

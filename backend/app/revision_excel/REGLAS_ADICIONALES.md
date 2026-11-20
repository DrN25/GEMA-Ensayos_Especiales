# Revisión de Excel de Ensayos Especiales

Fuente funcional: `Reglas_revision_ensayos_especiales.md`, entregado por la jefa.

## Alcance de esta versión

El usuario carga la base Excel y descarga el archivo auditado. Se conservan los
valores y el orden de A:AS. No hay consultas ni escrituras en SQL Server, ni
correcciones automáticas de los datos originales.

La hoja **Plantilla** contiene solo controles que funcionan con los datos de la
base. Los campos de PDF, página, clasificación manual de hallazgo, intervalos
externos y referencias manuales de PF o comprobaciones cruzadas se retiraron de
la hoja principal. No afectan el resultado actual.

El archivo incluye tres hojas:

1. **Plantilla** con datos y controles activos.
2. **Reglas de revisión** con ubicación y explicación de los controles y el
   estado del cálculo por grupos.
3. **Pendientes de integración** con los controles que necesitan fuentes o
   decisiones adicionales. No se presentan como comprobados automáticamente.

Es necesario volver a procesar y descargar el archivo para recibir esta versión.
Las descargas anteriores no se actualizan.

## Ubicación de los controles

| Columnas | Contenido |
| --- | --- |
| A:AS | Valores originales de la base |
| AT:BV | Revisión anterior; conserva sus criterios y operaciones |
| BW:CB | Auxiliares de la revisión anterior |
| CC:CH | Exclusiones, normalización y grupo de cálculo |
| CI:CJ | Código, sondaje, tipo e intervalo / longitud |
| CK:CO | UCS calculada, rango y tolerancia, E/ν, E/UCS y clasificación UCS/CE |
| CP | Tracción indirecta, rango y conversión kg/cm²–MPa |
| CQ:CX | Corte directo, unidades, rangos, regresión, constancia y secuencia |
| CY:DG | Triaxial, esfuerzos, confinamientos, HB, MC lineal y consistencia |
| DH:DI | Tipo de rotura y año/laboratorio |
| DJ | Resultado de los controles nuevos |
| DK:FC | Auxiliares de regresión, ocultos |
| FD:FJ | Índice de grupos y detección de cambios de identidad, ocultos |

**OBSERVACIÓN DE REVISIÓN** señala un control activo fuera de criterio, sin
confirmar un error contra PDF. **PENDIENTE** indica que falta un dato de la base
para un control activo. **EXCLUIDA** refleja la selección de Sí en CD.
**OK CONTROLES** se limita a los controles activos; no certifica revisión de PDF.

Las diferencias de umbral entre la plantilla anterior y el documento nuevo se
mantienen visibles. Por ejemplo, UCS anterior usa 1 % / 5 %, mientras que el
control nuevo usa 2.5 %. DJ no utiliza el resultado antiguo de BV.

## Formato visual

- Cabeceras desde CC: lavanda `#E8DFF5`, texto oscuro `#4C3267`.
- Celdas de cálculo: fondo blanco explícito y texto oscuro.
- Pendientes: naranja claro `#FFE5BF`, texto marrón oscuro `#713B08`.
- Observaciones: rojo claro `#FCE4D6`, texto rojo oscuro `#9C2415`.
- Excluidas: gris claro con texto oscuro.

Los rellenos diferenciales especifican ambos colores de patrón para evitar que
Excel interprete un fondo automático negro. El formato condicional se aplica
solo a columnas de estado, sin abarcar auxiliares y resultados numéricos.

## Reglas activas

- Códigos normalizados sin espacios, con guiones unificados y sin paréntesis.
  M01(A)=M01A. CE usa UCS en el código; TI admite TI y TR.
- Hasta > Desde y longitud igual a la diferencia, con tolerancia de 0.01 m.
- UCS calculada en MPa = carga kN × 10 / (π × diámetro cm² / 4), tolerancia
  relativa 2.5 %, diámetro 4–8 cm y resistencia 1–350 MPa.
- CE: E 1–120 GPa, ν 0.05–0.45 y E/UCS 100–1000 convirtiendo E a MPa.
  UCS con E y ν numéricos genera observación de clasificación.
- TI 0.5–30 MPa y kg/cm² = MPa × 10.197, con margen absoluto 0.01.
- CD: conversión kPa/MPa, área 10–80 cm², φ 15–60°, τ >0; regresión
  τ=c+σn·tanφ con c ±0.015 MPa, φ ±0.5° y R² ≥0.95. Constancia de c/φ/área
  y aumento del esfuerzo normal en el orden original de las etapas.
- TX: σ1 > σ3, confinamiento no negativo y al menos dos confinamientos distintos.
  Regresión HB de (σ1−σ3)² contra σ3; σci=√intercepto, mi=pendiente/σci,
  tolerancias 3 % y 10 %, mi 1–40. Constancia de σci/mi/c/φ y aumento de σ1 con σ3.
- MC lineal para Geomec/Ingeotest: σ1=a+kσ3, φ=asin((k−1)/(k+1)), c=a/(2√k).
- Rotura Geomec I–V e Ingeotest matriz/estructura/ambas. La clasificación UNI
  requiere el informe y se detalla en los pendientes.

Los controles nuevos separan año F, laboratorio D, sondaje, tipo y código
normalizado. M01A y M01B no se consolidan sin evidencia. Las repeticiones de
código se conservan como corridas.

CC registra las columnas rojas directas, por ejemplo `|AJ|AK|`. Cada control
omite las entradas rojas que necesita. Si se modifica un color en Excel, debe
actualizarse CC o seleccionar Sí en CD para excluir toda la fila. Los colores
producidos por formato condicional de origen requieren revisión manual. Los
controles anteriores conservan su comportamiento sin exclusión de color.

## Optimización del cálculo en Excel

El problema anterior era el trabajo repetido sobre rangos de todo el archivo,
tanto en las fórmulas nuevas como en SUMPRODUCT/COUNTIFS/SUMIFS de la plantilla.
Las fórmulas compartidas reducían el tamaño del archivo, pero no ese trabajo.

Ahora se construye en la primera lectura un índice compacto con el inicio y fin
de cada grupo. La segunda lectura sigue escribiendo las filas de forma
incremental. Las fórmulas usan referencias INDEX no volátiles al tramo del grupo,
manteniendo sus filtros incluso si hay filas de otros grupos intercaladas.
Los auxiliares de regresión solo agregan datos cuando corresponde a CD o TX.
La revisión anterior conserva su agrupación y criterios originales por código.
Los códigos anómalos con comodines o no textuales mantienen búsqueda completa
en los controles antiguos para no alterar sus reglas de comparación.

El cálculo sigue en **automático**. Se calcula al abrir el archivo nuevo y se
desactiva únicamente la obligación de recalcular todo el libro en cada cambio
(`forceFullCalc=0`), permitiendo el recálculo inteligente de Excel.

Las mediciones y exclusiones siguen siendo editables y recalculables. Si cambia
una identidad (año, laboratorio, sondaje, tipo o código), una señal global activa
la búsqueda completa para que el cambio de grupo no produzca resultados
incompletos. La hoja Reglas de revisión muestra ese estado. **Para recuperar el
cálculo rápido, procesar de nuevo el archivo con las identidades actualizadas.**
Las filas nuevas también requieren una nueva revisión; no se amplían fórmulas
fuera de las filas exportadas.

## Pendientes de integración

La tercera hoja explica el cotejo con PDF y su trazabilidad; clasificación de
hallazgos; correcciones manuales con colores y valor anterior; intervalos,
longitud histórica y cabida de probetas; particularidades de fecha y Lito1 UNI;
muestras A/B; discos no centrales y promedios TI; área inclinada y cargas CD;
equivalente HB de MC de UNI; propiedades físicas; referencias para cocientes
cruzados; conteos y comparación bidireccional; y códigos de rotura UNI por
informe/año. Se integrarán cuando estén disponibles las fuentes y el flujo.

## Compatibilidad y validación

Se mantienen las correcciones de apertura de Microsoft Excel: identificadores
únicos de hoja, declaraciones de compatibilidad XML preservadas, columnas sin
solapamientos y spans de cabecera actualizados. La plantilla binaria original
no se modifica, y no se agregan dependencias de producción.

Pruebas de esta revisión:

- 14 pruebas automatizadas sin acceso a SQL Server.
- 60 verificaciones numéricas sobre 18 escenarios sintéticos, sin errores de
  fórmula en los controles nuevos.
- 1.242 comparaciones entre la versión optimizada y las búsquedas completas,
  incluyendo los controles anteriores, con resultados equivalentes.
- 6 comprobaciones de recálculo/exclusión y 5 de cambio/restauración de identidad.
- Vista previa inspeccionada para el formato de las nuevas cabeceras. Los
  colores condicionales se verificaron también en las definiciones del archivo.

Con la base de 9.361 registros hay 4.818 grupos, de tamaño máximo 5 filas.
Una búsqueda por fila pasa de 87.628.321 candidatos acumulados a 26.845 en los
rangos indexados (99.9694 % menos candidatos). Esta cifra expresa trabajo de
búsqueda, **no una reducción medida del porcentaje de CPU**.

La generación local tardó aproximadamente 4.6 s y produjo un archivo de 7.10 MiB.
En un proceso de prueba aislado se midieron 42.09 MiB de base y 47.69 MiB de pico
(incremento 5.60 MiB). No incluye FastAPI ni los otros sistemas. El tiempo y CPU
reales de apertura/recálculo deben comprobarse en Microsoft Excel de escritorio.

Archivos principales: `rules.py` define controles, `grouping.py` el índice y las
referencias acotadas, `layout.py` las hojas y estilos, y `service.py` la lectura
y escritura incremental con fórmulas compartidas.

### Exportación de referencias dinámicas

Ante el aviso de reparación que elimina fórmulas y fórmulas compartidas, las
expresiones con INDEX se exportan como fórmulas individuales. Las fórmulas
escalares restantes siguen compartidas. Se conservan los rangos acotados y el
cálculo automático. El archivo puede ocupar más espacio; las descargas previas
deben regenerarse. La apertura sin reparación debe confirmarse en Excel.

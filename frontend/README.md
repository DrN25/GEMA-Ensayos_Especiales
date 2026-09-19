# Frontend - Sistema de Ensayos Especiales (SIGEG)

Este directorio contiene la interfaz de usuario interactiva desarrollada en **React (Vite) + TypeScript + Tailwind CSS**, ejecutándose en el puerto `5175`.

## Estructura y Roles de los Archivos

*   `src/App.tsx`: Orquestador principal del frontend. Maneja el estado global del sistema, la barra de navegación lateral (Sidebar) y superior (TopBar), la vista activa del geólogo y la carga del historial de regreso.
*   `src/index.css`: Sistema de diseño global con variables HSL para soporte de modo claro/oscuro y clases utilitarias de vidrio (Glassmorphism).
*   `src/utils/columnsConfig.ts`: Archivo declarativo central que define las 47 columnas de la base de datos de Excel, incluyendo nombres de visualización, letras de columna en Excel, tipos de datos, rangos permitidos para QA/QC, fórmulas de cálculo en tiempo real y a qué módulos corresponden.
*   `src/utils/excelParser.ts`: Analizador interactivo de Excel. Lee el archivo subido en el navegador utilizando la biblioteca `xlsx` y mapea los datos de las columnas a la estructura del sistema basándose en la configuración centralizada de `columnsConfig.ts`.
*   `src/utils/qaqcValidator.ts`: Motor de validación reactivo (Real-time). Valida celdas de forma instantánea al escribir, aplicando límites de rangos lógicos, redondeando a 2 decimales y calculando dinámicamente campos con fórmulas.
*   `src/components/Layout/Sidebar.tsx`: Barra de navegación lateral colapsable con accesos directos al Dashboard, Registro Maestro, y los 6 módulos de ensayos.
*   `src/components/Layout/TopBar.tsx`: Barra superior que muestra el estado de conexión a SQL Server, herramientas de modo oscuro/claro y migas de pan con historial de navegación.
*   `src/components/Tables/BaseGrid.tsx`: Grilla tabular única y reutilizable. Renderiza cualquier conjunto de columnas filtrado por módulo, soporta scroll horizontal fluido, columnas congeladas (`Sondaje`, `Código de muestra`), edición en línea, y pintado de bordes de celdas con errores críticos o advertencias de QA/QC.
*   `src/components/Modals/ExcelImportModal.tsx`: Modal para la carga e importación interactiva del archivo de Excel. Muestra una vista previa de los registros parseados y sus correspondientes alertas antes de guardarse en el backend.
*   `src/components/Modals/ExcelExportModal.tsx`: Modal para la descarga parametrizada de registros filtrados por tipo de ensayo, rangos o sectores en formato Excel.
*   `src/components/Validation/ValidationPanel.tsx`: Panel flotante en la esquina inferior derecha que recopila de manera proactiva todas las alertas físicas del sistema y provee botones de enfoque de cursor para enfocar la celda problemática de forma automática.
*   `src/views/`: Contiene las páginas individuales del sistema:
    *   `Dashboard.tsx`: Resumen de indicadores clave de rendimiento (KPIs) y distribución por tipo de ensayo en tarjetas visuales de gran impacto.
    *   `RegistroMaestro.tsx`: Grilla maestra general que permite editar y ver todas las 47 variables del sistema.
    *   `DistribucionModulos.tsx`: Menú modular con las 6 tarjetas de ensayos geotécnicos.
    *   `CompresionUniaxial.tsx` / `ConstantesElasticas.tsx` / `TraccionIndirecta.tsx` / `CorteDirecto.tsx` / `CompresionTriaxial.tsx` / `PropiedadesFisicas.tsx`: Páginas individuales optimizadas que cargan el componente `BaseGrid` filtrando únicamente las columnas relevantes para cada ensayo.
    *   `Reportes.tsx`: Módulo para visualización e impresión de fichas de ensayo en formato PDF o Excel.
    *   `Configuracion.tsx`: Panel de control de base de datos, pruebas de ping al backend e historial de logs.

## Relaciones

```mermaid
graph TD
    App.tsx --> src/components/Layout/Sidebar.tsx
    App.tsx --> src/components/Layout/TopBar.tsx
    App.tsx --> src/views/ (Vistas del Sistema)
    src/views/ --> src/components/Tables/BaseGrid.tsx
    src/components/Tables/BaseGrid.tsx --> src/utils/columnsConfig.ts
    src/components/Tables/BaseGrid.tsx --> src/utils/qaqcValidator.ts
    src/views/ --> src/components/Modals/ExcelImportModal.tsx
    src/components/Modals/ExcelImportModal.tsx --> src/utils/excelParser.ts
```

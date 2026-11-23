-- Ejecutar manualmente en la COPIA LOCAL de la BD compartida antes de reiniciar el backend.
-- Es aditivo e idempotente: no borra reportes, imágenes ni datos de otros módulos.
-- Muestreo se conserva solo por compatibilidad; el código nuevo ya no lo utiliza.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.reporte_ensayo', N'U') IS NULL
    THROW 51120, 'Falta dbo.reporte_ensayo. Ejecutar antes 002_reporte_ensayo.sql.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH(N'dbo.reporte_ensayo', N'ejecutor') IS NULL
        ALTER TABLE dbo.reporte_ensayo ADD ejecutor nvarchar(150) NOT NULL
            CONSTRAINT DF_reporte_ensayo_ejecutor DEFAULT (N'') WITH VALUES;

    IF COL_LENGTH(N'dbo.reporte_ensayo', N'supervisor') IS NULL
        ALTER TABLE dbo.reporte_ensayo ADD supervisor nvarchar(150) NOT NULL
            CONSTRAINT DF_reporte_ensayo_supervisor DEFAULT (N'') WITH VALUES;

    -- Los INSERT nuevos omiten Muestreo; la columna original era NOT NULL.
    -- Mantenerla con valor predeterminado permite conservar datos existentes.
    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.reporte_ensayo')
          AND name = N'muestreo' AND default_object_id = 0
    )
        ALTER TABLE dbo.reporte_ensayo ADD CONSTRAINT DF_reporte_ensayo_muestreo_legacy
            DEFAULT (N'') FOR muestreo;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT DB_NAME() AS BaseActual, c.name AS Columna, TYPE_NAME(c.user_type_id) AS Tipo,
       c.max_length AS LongitudEnBytes, c.is_nullable AS PermiteNull,
       OBJECT_DEFINITION(c.default_object_id) AS ValorPredeterminado
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.reporte_ensayo')
  AND c.name IN (N'ejecutor', N'supervisor', N'muestreo')
ORDER BY c.name;

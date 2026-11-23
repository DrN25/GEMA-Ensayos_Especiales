-- Ejecutar manualmente en la BD LOCAL primero. No modifica tablas de los otros sistemas.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.reporte_ensayo', N'U') IS NULL
    THROW 50001, 'Falta dbo.reporte_ensayo. Aplicar antes la migración 002.', 1;

IF OBJECT_ID(N'dbo.reporte_ensayo_imagen', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.reporte_ensayo_imagen (
        id_imagen VARCHAR(36) NOT NULL CONSTRAINT PK_reporte_ensayo_imagen PRIMARY KEY,
        codigo_muestra VARCHAR(150) NOT NULL,
        posicion VARCHAR(10) NOT NULL,
        usuario_id INT NOT NULL,
        id_reporte INT NULL,
        proveedor VARCHAR(20) NOT NULL,
        bucket VARCHAR(100) NOT NULL,
        objeto VARCHAR(250) NOT NULL,
        bytes INT NOT NULL,
        ancho INT NULL,
        alto INT NULL,
        sha256 VARCHAR(64) NULL,
        estado VARCHAR(12) NOT NULL,
        fecha_registro DATETIME2 NOT NULL,
        CONSTRAINT FK_reporte_imagen_reporte FOREIGN KEY (id_reporte) REFERENCES dbo.reporte_ensayo(id_reporte),
        CONSTRAINT CK_reporte_imagen_posicion CHECK (posicion IN ('antes','despues')),
        CONSTRAINT CK_reporte_imagen_estado CHECK (estado IN ('pendiente','lista')),
        CONSTRAINT CK_reporte_imagen_bytes CHECK (bytes > 0 AND bytes <= 1048576)
    );
    CREATE UNIQUE INDEX UX_reporte_imagen_posicion ON dbo.reporte_ensayo_imagen(id_reporte,posicion)
        WHERE id_reporte IS NOT NULL;
    CREATE UNIQUE INDEX UX_reporte_imagen_objeto ON dbo.reporte_ensayo_imagen(bucket,objeto);
    CREATE INDEX IX_reporte_imagen_limpieza ON dbo.reporte_ensayo_imagen(fecha_registro)
        INCLUDE (id_reporte,estado);
END;
COMMIT TRANSACTION;

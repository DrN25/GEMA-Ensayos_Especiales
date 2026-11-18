-- Ejecutar en la base compartida de GEMA que contiene dbo.registro_maestro.
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.registro_maestro', N'U') IS NULL OR OBJECT_ID(N'auth.Usuarios', N'U') IS NULL
    THROW 51110, 'Selecciona la base de Ensayos Especiales con Registro Maestro y autenticacion.', 1;

BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo.reporte_ensayo', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.reporte_ensayo (
            id_reporte int IDENTITY(1,1) NOT NULL CONSTRAINT PK_reporte_ensayo PRIMARY KEY,
            codigo_muestra varchar(150) NOT NULL,
            numero_informe nvarchar(100) NOT NULL,
            fecha_emision date NOT NULL,
            texto_titulo nvarchar(150) NOT NULL,
            ubicacion nvarchar(200) NOT NULL,
            muestreo nvarchar(150) NOT NULL,
            material nvarchar(150) NOT NULL,
            presentacion nvarchar(150) NOT NULL,
            muestreado nvarchar(150) NOT NULL,
            profundidad nvarchar(100) NOT NULL,
            usuario_id int NOT NULL,
            usuario_emisor nvarchar(50) NOT NULL,
            fecha_registro datetime2 NOT NULL,
            version_plantilla varchar(30) NOT NULL,
            solicitud_id varchar(36) NOT NULL CONSTRAINT UQ_reporte_ensayo_solicitud UNIQUE,
            datos_emitidos nvarchar(max) NOT NULL,
            CONSTRAINT CK_reporte_ensayo_datos_json CHECK (ISJSON(datos_emitidos) = 1)
        );
    END;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

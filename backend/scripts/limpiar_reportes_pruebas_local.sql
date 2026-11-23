-- OPCIONAL. Solo para borrar el historial de REPORTES DE PRUEBA en tu BD LOCAL.
-- No ejecuta cambios con @EliminarPruebas = 0. No elimina archivos de R2/Drive.
-- No toca registro_maestro, autenticación ni tablas de otros módulos/sistemas.
USE [db_ad0a4f_gema];
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @EliminarPruebas bit = 0;
DECLARE @EquipoLocal sysname = N'COMPLETAR_CON_MACHINE_NAME_LOCAL';
SELECT DB_NAME() AS BaseActual, SERVERPROPERTY('ServerName') AS Servidor,
       SERVERPROPERTY('MachineName') AS MachineName;
IF OBJECT_ID(N'dbo.reporte_ensayo', N'U') IS NULL
    THROW 50001, 'No existe la tabla de reportes esperada.', 1;
SELECT COUNT_BIG(*) AS ReportesQueSeEliminarian FROM dbo.reporte_ensayo;
IF OBJECT_ID(N'dbo.reporte_ensayo_imagen', N'U') IS NOT NULL
    SELECT COUNT_BIG(*) AS ReferenciasQueSeEliminarian FROM dbo.reporte_ensayo_imagen;
IF @EliminarPruebas = 0
BEGIN
    PRINT 'Solo simulación. Para borrar, confirma la BD LOCAL, completa @EquipoLocal y cambia @EliminarPruebas a 1.';
    RETURN;
END;
IF CONVERT(sysname, SERVERPROPERTY('MachineName')) <> @EquipoLocal
    THROW 50002, 'El servidor no coincide con el equipo local confirmado. No se elimina nada.', 1;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.reporte_ensayo_imagen', N'U') IS NOT NULL
    DELETE FROM dbo.reporte_ensayo_imagen;
DELETE FROM dbo.reporte_ensayo;
COMMIT TRANSACTION;
PRINT 'Historial local de pruebas eliminado. No se reiniciaron identidades ni se tocaron archivos externos.';

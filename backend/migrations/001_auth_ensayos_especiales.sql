-- Ejecutar en la base compartida donde ya se migró auth para Mapeo y Logueo.
-- Para la primera ejecución, completa el correo y copia el hash bcrypt generado
-- con el comando de la guía. Usa una contraseña distinta en local y producción.
-- Una nueva ejecución conserva la cuenta y su contraseña actual.
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @AdminUsuario nvarchar(50) = N'ADMIN_ESPECIALES';
DECLARE @AdminEmail nvarchar(200) = N'';
DECLARE @AdminHash nvarchar(255) = N'';

IF OBJECT_ID(N'auth.Sistemas', N'U') IS NULL
    OR OBJECT_ID(N'auth.Roles', N'U') IS NULL
    OR OBJECT_ID(N'auth.Usuarios', N'U') IS NULL
    OR OBJECT_ID(N'auth.Permisos', N'U') IS NULL
    OR OBJECT_ID(N'auth.RolPermisos', N'U') IS NULL
    OR COL_LENGTH(N'auth.Usuarios', N'VersionSeguridad') IS NULL
    THROW 51100, 'Selecciona la base compartida que ya tiene la migracion auth de GEMA.', 1;

IF NOT EXISTS (SELECT 1 FROM auth.Sistemas WHERE Codigo = N'mapeo')
    OR NOT EXISTS (SELECT 1 FROM auth.Sistemas WHERE Codigo = N'logueo')
    THROW 51101, 'No se encontraron los sistemas Mapeo y Logueo en esta base.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @SistemaID int, @RolID int, @UsuarioID int;
    SELECT @SistemaID = SistemaID FROM auth.Sistemas WITH (UPDLOCK, HOLDLOCK) WHERE Codigo = N'especiales';
    IF @SistemaID IS NULL
    BEGIN
        INSERT auth.Sistemas (Codigo, Nombre, Estado) VALUES (N'especiales', N'GEMA-Ensayos_Especiales', 'A');
        SET @SistemaID = CONVERT(int, SCOPE_IDENTITY());
    END;

    IF NOT EXISTS (SELECT 1 FROM auth.Sistemas WHERE SistemaID = @SistemaID AND Estado = 'A')
        THROW 51102, 'El sistema especiales ya existe pero esta inactivo.', 1;

    IF NOT EXISTS (SELECT 1 FROM auth.Roles WITH (UPDLOCK, HOLDLOCK) WHERE SistemaID = @SistemaID AND Nombre = N'admin')
        INSERT auth.Roles (SistemaID, Nombre, Descripcion, Estado, EsProtegido)
        VALUES (@SistemaID, N'admin', N'Administrador de cuentas de Ensayos Especiales.', 'A', 1);

    IF NOT EXISTS (SELECT 1 FROM auth.Roles WITH (UPDLOCK, HOLDLOCK) WHERE SistemaID = @SistemaID AND Nombre = N'usuario')
        INSERT auth.Roles (SistemaID, Nombre, Descripcion, Estado, EsProtegido)
        VALUES (@SistemaID, N'usuario', N'Cuenta operativa de Ensayos Especiales.', 'A', 0);

    SELECT @RolID = RolID FROM auth.Roles
    WHERE SistemaID = @SistemaID AND Nombre = N'admin' AND Estado = 'A' AND EsProtegido = 1;
    IF @RolID IS NULL
        THROW 51103, 'Revisa el rol admin existente de Ensayos Especiales.', 1;

    SELECT @UsuarioID = UsuarioID FROM auth.Usuarios WITH (UPDLOCK, HOLDLOCK) WHERE Usuario = @AdminUsuario;
    IF @UsuarioID IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM auth.Usuarios WHERE UsuarioID = @UsuarioID
            AND SistemaID = @SistemaID AND RolID = @RolID AND EsProtegido = 1 AND Estado = 'A'
    )
        THROW 51104, 'El usuario inicial ya existe con otra configuracion. Revisa el usuario antes de continuar.', 1;

    IF @UsuarioID IS NULL
    BEGIN
        SET @AdminEmail = LOWER(LTRIM(RTRIM(@AdminEmail)));
        IF @AdminEmail NOT LIKE N'%_@_%._%' OR @AdminEmail LIKE N'% %'
            THROW 51105, 'Completa el correo real del administrador inicial.', 1;
        IF LEN(@AdminHash) <> 60 OR LEFT(@AdminHash, 4) NOT IN (N'$2a$', N'$2b$', N'$2y$')
            THROW 51106, 'Completa el hash bcrypt del administrador inicial.', 1;
        IF EXISTS (SELECT 1 FROM auth.Usuarios WITH (UPDLOCK, HOLDLOCK) WHERE SistemaID = @SistemaID AND Email = @AdminEmail)
            THROW 51107, 'El correo ya esta registrado en Ensayos Especiales.', 1;

        INSERT auth.Usuarios (
            Usuario, Email, ContrasenaHash, NombreCompleto, RolID, Estado, FechaRegistro,
            UsuarioRegistro, SistemaID, EsProtegido, VersionSeguridad
        ) VALUES (
            @AdminUsuario, @AdminEmail, @AdminHash, N'Administrador de Ensayos Especiales',
            @RolID, 'A', SYSUTCDATETIME(), N'migracion_ensayos_especiales', @SistemaID, 1, 0
        );
    END;

    COMMIT TRANSACTION;

    SELECT s.Codigo, s.Nombre, u.Usuario, r.Nombre AS Rol, u.Estado, u.EsProtegido
    FROM auth.Usuarios AS u
    JOIN auth.Sistemas AS s ON s.SistemaID = u.SistemaID
    JOIN auth.Roles AS r ON r.SistemaID = u.SistemaID AND r.RolID = u.RolID
    WHERE u.SistemaID = @SistemaID AND u.Usuario = @AdminUsuario;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

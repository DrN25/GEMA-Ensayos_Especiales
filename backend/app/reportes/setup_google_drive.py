"""Local CLI authorization only. Does not import the database or load .env files."""
import argparse
import json
from pathlib import Path

import httpx

SCOPE = 'https://www.googleapis.com/auth/drive.file'


def main():
    parser = argparse.ArgumentParser(description='Autorizar una cuenta de Google para las fotografías de GEMA (pruebas locales).')
    parser.add_argument('--client', required=True, help='JSON del cliente OAuth de tipo Aplicación de escritorio.')
    parser.add_argument('--token', default='.secrets/google-drive-token.json', help='Destino privado de la autorización.')
    parser.add_argument('--folder-id', help='Reutilizar una carpeta creada anteriormente por este mismo cliente OAuth.')
    parser.add_argument('--name', default='GEMA - Ensayos Especiales - LOCAL', help='Nombre de la nueva carpeta raíz en Mi unidad.')
    args = parser.parse_args()
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        parser.error('Instala primero requirements.txt en el entorno virtual del backend.')
    # Official loopback flow with PKCE. No tokens/passwords printed or sent to GEMA users.
    flow = InstalledAppFlow.from_client_secrets_file(args.client, scopes=[SCOPE], autogenerate_code_verifier=True)
    credentials = flow.run_local_server(host='127.0.0.1', port=0, open_browser=True,
                                        access_type='offline', prompt='consent',
                                        authorization_prompt_message='Se abrirá Google para autorizar la cuenta de pruebas.',
                                        success_message='Autorización recibida. Ya puedes cerrar esta pestaña y volver a PowerShell.')
    if not credentials.refresh_token:
        parser.error('Google no devolvió acceso sin conexión. Revoca el permiso anterior de esta app y vuelve a autorizarla.')
    token_path = Path(args.token).resolve()
    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(credentials.to_json(), encoding='utf-8')
    try:
        with httpx.Client(timeout=30, headers={'Authorization': 'Bearer ' + credentials.token}) as client:
            if args.folder_id:
                response = client.get('https://www.googleapis.com/drive/v3/files/' + args.folder_id,
                                      params={'fields': 'id,mimeType,trashed,capabilities(canAddChildren)', 'supportsAllDrives': 'true'})
            else:
                response = client.post('https://www.googleapis.com/drive/v3/files', params={'fields': 'id,mimeType,capabilities(canAddChildren)'},
                                       json={'name': args.name, 'mimeType': 'application/vnd.google-apps.folder',
                                             'appProperties': {'gema_raiz': 'reportes'}})
            if not response.is_success:
                parser.error('No se pudo crear/acceder a la carpeta. Revisa Google Drive API y el alcance drive.file. No uses una carpeta ajena a este cliente OAuth.')
            info = response.json()
            if info.get('trashed') or info.get('mimeType') != 'application/vnd.google-apps.folder' or not info.get('capabilities', {}).get('canAddChildren'):
                parser.error('La carpeta no permite guardar fotografías.')
    except httpx.HTTPError:
        parser.error('No se pudo conectar con Google Drive. La autorización quedó guardada; reintenta la configuración.')
    folder = info['id']
    config_path = token_path.parent / 'google-drive-config.txt'
    config_path.write_text(f'GOOGLE_DRIVE_TOKEN_FILE={token_path.as_posix()}\nGOOGLE_DRIVE_ROOT_FOLDER_ID={folder}\n', encoding='utf-8')
    print('Configuración lista. No compartas ni subas los archivos JSON de .secrets a GitHub.')
    print('Copia las dos líneas de este archivo al .env del backend: ' + str(config_path))
    print('Carpeta: https://drive.google.com/drive/folders/' + folder)


if __name__ == '__main__':
    main()

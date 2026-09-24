import type {SettingSchemaDesc} from '@logseq/libs/dist/LSPlugin';

export const settingsSchema: SettingSchemaDesc[] = [
    {
        key: 'instanceUrl',
        type: 'string',
        title: 'URL de la Instancia',
        description: 'URL completa de tu instancia de GoToSocial (ej. https://social.midominio.com)',
        default: '',
    },
    {
        key: 'accessToken',
        type: 'string',
        title: 'Access Token',
        description: 'Token de acceso personal con permisos read:statuses y write:statuses',
        default: '',
    },
];
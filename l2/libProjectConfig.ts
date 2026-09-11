/// <mls fileReference="_102027_/l2/libProjectConfig.ts" enhancement="_blank"/>


export const projectConfig: IProjectConfigCache = {};

const FILENAME = 'project';
const LEVEL = 5;
const EXTENSION = '.json';

export async function clearLocalChanges(project: number) {

    if (project === undefined) return;
    const key = mls.stor.getKeyToFiles(project, LEVEL, FILENAME, '', EXTENSION);
    let configFile = mls.stor.files[key];
    if (!configFile) return;
    const config = await getConfigProject(project, true);
    if (!config) return;
    await mls.stor.localStor.setContent(configFile, {
        contentType: 'string',
        content: null
    });
    configFile.inLocalStorage = false;
}

export async function getConfigProject(project: number, ignoreLocalChanges = false): Promise<mls.l5_common.ProjectConfig | undefined> {

    if (project === undefined) return undefined;
    const key = mls.stor.getKeyToFiles(project, LEVEL, FILENAME, '', EXTENSION);
    let configFile = mls.stor.files[key];
    if (!configFile) return undefined;

    if (!projectConfig[project] /*|| (projectConfig[project].versionRef !== configFile.versionRef)*/ || ignoreLocalChanges) {

        const lastStatus = configFile.inLocalStorage;
        if (ignoreLocalChanges && configFile.status !== 'new') {
            configFile.inLocalStorage = false;
        }
        const content = await configFile.getContent();
        configFile.inLocalStorage = lastStatus;
        if (!content || typeof content !== 'string') return undefined;
        const config = JSON.parse(content);
        projectConfig[project] = {
            config,
            versionRef: configFile.versionRef
        }
    }

    return projectConfig[project].config;
}

async function saveProjectConfigFile(project: number, content: string): Promise<void> {
    const { saveL5File } = await import('/_102033_/l2/cbe/l5Save.js');
    await saveL5File(project, FILENAME, content, 'save l5/project.json');
}

export async function updateConfigProject(project: number, newConfig: mls.l5_common.ProjectConfig, save = false): Promise<void> {
    const key = mls.stor.getKeyToFiles(project, LEVEL, FILENAME, '', EXTENSION);
    const configFile = mls.stor.files[key];
    if (!configFile || !projectConfig[project]) throw new Error('No config file!');
    projectConfig[project].config = newConfig;
    const content = JSON.stringify(newConfig, null, 2);
    await mls.stor.localStor.setContent(configFile, {
        contentType: 'string',
        content
    });
    if (save) await saveProjectConfigFile(project, content);
}

export async function updateConfigProjectPlugins(
    project: number,
    newPlugins: { [key: string]: mls.l5_common.IPlugin; },
    save = false,
): Promise<void> {
    const key = mls.stor.getKeyToFiles(project, LEVEL, FILENAME, '', EXTENSION);
    const configFile = mls.stor.files[key];
    if (!configFile || !projectConfig[project]) throw new Error('No config file!');
    projectConfig[project].config.plugins = newPlugins;
    const content = JSON.stringify(projectConfig[project].config, null, 2);
    await mls.stor.localStor.setContent(configFile, {
        contentType: 'string',
        content
    });
    if (save) await saveProjectConfigFile(project, content);
}


export async function createConfigFile(project: number): Promise<mls.l5_common.ProjectConfig> {

    if (project === undefined) throw new Error('Invalid project')
    const key = mls.stor.getKeyToFiles(project, LEVEL, FILENAME, '', EXTENSION);
    let configFile = mls.stor.files[key];
    if (configFile) throw new Error('config file already exists');
    const config = await _createConfigFile(project);

    if (!projectConfig[project]) {
        projectConfig[project] = {
            config,
            versionRef: ''
        }
    }
    projectConfig[project].config = config;
    return projectConfig[project].config;
}

async function _createConfigFile(project: number) {
    const newConfig: mls.l5_common.ProjectConfig = {
        orgName: '[org]',
        designSystems: [],
        languages: [
            {
                language: "en",
                name: "English",
                path: "/"
            }
        ],
        plugins: {},
        reasons: {},
        services: [],
        links: [],
        servicesConfigEnabled: false,
    }
    const content = JSON.stringify(newConfig);
    const params = {
        project,
        level: LEVEL,
        shortName: FILENAME,
        extension: EXTENSION,
        versionRef: '0',
        folder: ''
    };
    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error('invalid file');
    file.status = 'new';
    const fileInfo: mls.stor.IFileInfoValue = {
        content,
        contentType: 'string',
    };
    await mls.stor.localStor.setContent(file, fileInfo);
    return newConfig;
}

interface IProjectConfigCache {
    [key: number]: {
        versionRef: string;
        config: mls.l5_common.ProjectConfig;
    }
}
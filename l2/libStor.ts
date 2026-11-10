/// <mls fileReference="_102027_/l2/libStor.ts" enhancement="_blank"/>

import { convertFileNameToTag } from '/_102027_/l2/utils.js';


export async function createStorFile(req: IReqCreateStorFile, needCreateModel: boolean, needCompile: boolean = true, awaitCompile: boolean = false): Promise<mls.stor.IFileInfo> {

    const params = {
        project: req.project,
        level: req.level,
        shortName: req.shortName,
        extension: req.extension,
        versionRef: '0',
        folder: req.folder,
        updatedAt: new Date().toISOString()
    };

    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error('[createStorFile] Invalid storFile');

    file.status = req.status ?? 'new';

    let source = req.source;
    if (req.level === 2) {
        const { verifyNeedAddTripleslach } = await import('/_102027_/l2/libCommom.js');
        source = verifyNeedAddTripleslach(params, req.source, req.extension)
    }
    const fileInfo: mls.stor.IFileInfoValue = {
        content: source,
        contentType: 'string'
    };

    if (req.fileInfo) {
        fileInfo.originalFolder = req.fileInfo.originalFolder;
        fileInfo.originalProject = req.fileInfo.originalProject;
        fileInfo.originalShortName = req.fileInfo.originalShortName;
    }

    await mls.stor.localStor.setContent(file, fileInfo);

    if (needCreateModel && ['.ts', '.html', '.defs.ts', '.test.ts'].includes(file.extension)) {
        const { createModel } = await import('/_102027_/l2/libModel.js');
        await createModel(file, needCompile, awaitCompile);
    }

    // file.getModel = async () => _getModel(file);

    return file;

}

export async function createAllFiles(req: IReqCreateAllFiles, needCreateModel: boolean = true, awaitCompile: boolean = false): Promise<IRetAllFiles> {

    const { folder, shortName, project } = req;
    const { getBaseTemplate } = await import('/_102027_/l2/libCommom.js');

    const template = await getBaseTemplate({ folder, shortName, project, extension: '.ts' }, req.enhancement);

    const templateHTML = await getBaseTemplate({ folder, shortName, project, extension: '.html' });

    const templateLess = await getBaseTemplate({ folder, shortName, project, extension: '.less' }, 'enhancementStyle');

    const templateTest = await getBaseTemplate({ folder, shortName, project, extension: '.test.ts' });

    const templateDefs = await getBaseTemplate({ folder, shortName, project, extension: '.defs.ts' });

    const newTSSource = req.tsSource || template;
    const newHTMLSource = req.htmlSource || templateHTML;
    const newLessSource = req.lessSource || templateLess;
    const newTestSource = req.testSource || templateTest;
    const newDefsSource = req.defsSource || templateDefs;

    const param: IReqCreateStorFile = {
        project: req.project,
        shortName: req.shortName,
        folder: req.folder,
        level: req.level,
        extension: '.ts',
        source: newTSSource,
        status: 'new'
    };

    const ret: IRetAllFiles = {
        ts: await safeCreate(param, false)
    }

    ret.html = await safeCreate({ ...param, extension: '.html', source: newHTMLSource }, false);
    ret.less = await safeCreate({ ...param, extension: '.less', source: newLessSource }, false);
    ret.test = await safeCreate({ ...param, extension: '.test.ts', source: newTestSource }, false);
    ret.def = await safeCreate({ ...param, extension: '.defs.ts', source: newDefsSource }, false);

    if (needCreateModel && ret.ts && !(ret.ts instanceof Error)) {
        const { createAllModels } = await import('/_102027_/l2/libModel.js');
        await createAllModels(ret.ts, true, awaitCompile);
    }

    return ret;

}

type HostUnlink = (file: mls.stor.IFileInfo) => unknown;

function hostUnlink(): HostUnlink | undefined {
    const fn = (mls.stor.localStor as { deleteFile?: unknown }).deleteFile;
    return typeof fn === 'function' ? fn as HostUnlink : undefined;
}

export async function deleteFile(storFile: mls.stor.IFileInfo): Promise<void> {

    const unlink = hostUnlink();
    if (unlink) {
        await unlink(storFile);
        if (storFile.status === 'deleted') {
            mls.events.fireFileAction('statusOrErrorChanged', storFile, 'left', 0);
            mls.events.fireFileAction('statusOrErrorChanged', storFile, 'right', 0);
        }
        return;
    }

    if (storFile.status === 'new') {
        await deleteFileSystem(storFile);
        return;
    }

    const keyToModel = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);

    if (storFile.getValueInfo) {
        let valueInfo = mls.editor.models[keyToModel] ? await storFile.getValueInfo() : {} as mls.stor.IFileInfoValue;
        if (!valueInfo.content) {
            const src = await storFile.getContent() as string;
            valueInfo = {
                content: src,
                contentType: 'string',
                originalShortName: storFile.shortName,
                originalProject: storFile.project,
                originalCRC: mls.common.crc.crc32(src).toString(16)
            }
        }
        await mls.stor.localStor.setContent(storFile, valueInfo);
    }
    // Host setContent promotes status to `changed`. Mark deleted after the trash write so the
    // in-memory object stays deleted (getFileModified treats deleted as absent).
    storFile.status = 'deleted';
    mls.events.fireFileAction('statusOrErrorChanged', storFile, 'left', 0);
    mls.events.fireFileAction('statusOrErrorChanged', storFile, 'right', 0);

}

export async function deleteAllFiles(storFile: mls.stor.IFileInfo): Promise<void> {

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;

        await deleteFile(mls.stor.files[key]);

    }

}

export async function removeNewStorFilesWithTemplateDefault(): Promise<mls.stor.IFileInfo[]> {

    const removed: mls.stor.IFileInfo[] = [];
    const project = mls.actualProject;
    if (!project) return removed;

    // snapshot: deleteFile remove entradas de mls.stor.files durante o loop
    const files = Object.values(mls.stor.files).filter((f) => f && f.project === project && f.status === 'new');

    const { isStorContentEqualTemplateDefault } = await import('/_102027_/l2/libCommom.js');

    for await (const storFile of files) {

        const isTemplate = await isStorContentEqualTemplateDefault(storFile);
        if (!isTemplate) continue;

        await deleteFile(storFile); // status 'new' -> remoção real (deleteFileSystem)
        removed.push(storFile);

    }

    return removed;

}

export async function renameFile(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, needCompile: boolean = true): Promise<mls.stor.IFileInfo> {

    let source = await storFile.getContent() as string;
    if (!source) throw new Error('[renameFile] Impossible rename this file:' + storFile.shortName);

    //if (!newFolder) newFolder = storFile.folder;

    source = replaceTripleslashAndTag(storFile, newProject, newShortName, newFolder, source);

    const param: IReqCreateStorFile = {
        shortName: newShortName,
        project: newProject,
        folder: newFolder,
        level: storFile.level,
        source: source,
        extension: storFile.extension,
        status: storFile.status === 'new' ? 'new' : 'renamed',
        fileInfo: {
            originalFolder: storFile.folder,
            originalProject: storFile.project,
            originalShortName: storFile.shortName
        }
    }

    const needCreateModels = param.level === 2;
    const file = await createStorFile(param, needCreateModels, needCompile);
    await deleteFileSystem(storFile);
    mls.events.fireFileAction('statusOrErrorChanged', file, 'left', 0);
    mls.events.fireFileAction('statusOrErrorChanged', file, 'right', 0);

    return file;
}

export async function renameAllFiles(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, needCompile: boolean = true): Promise<IRetAllFiles> {

    const ret: IRetAllFiles = {};

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts', '.json']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;

        const prop = mapExt[ext];
        ret[prop] = await safeRename(mls.stor.files[key], newProject, newShortName, newFolder, needCompile);

    }

    return ret;

}

export async function cloneFile(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string): Promise<mls.stor.IFileInfo> {

    let source = await storFile.getContent() as string;
    if (!source) throw new Error('[cloneFile] Impossible rename this file:' + storFile.shortName);

    source = replaceTripleslashAndTag(storFile, newProject, newShortName, storFile.folder, source);

    const param: IReqCreateStorFile = {
        shortName: newShortName,
        project: newProject,
        folder: storFile.folder,
        level: storFile.level,
        source: source,
        extension: storFile.extension,
        status: 'new'
    }

    const file = await createStorFile(param, true);
    return file;

}

export async function cloneAllFiles(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string): Promise<IRetAllFiles> {

    const ret: IRetAllFiles = {};

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;

        const prop = mapExt[ext];
        ret[prop] = await safeClone(mls.stor.files[key], newProject, newShortName);

    }

    return ret;

}

export async function undoFile(storFile: mls.stor.IFileInfo, removeProject: boolean = true): Promise<void> {
    const draft = await draftUndoMode(storFile.project);
    if (draft.kind === 'broken') {
        storFile.getValueInfo = undefined;
        showUndoError('driver', draft.detail);
        return;
    }
    if (draft.kind === 'on') {
        const { draftUndoBrowserOnly } = await import('/_102033_/l2/cbe/studioDraftFiles.js');
        if (!draftUndoBrowserOnly()) {
            // `nochange` without a local copy is the saved file the old code skipped.
            await undoFilePublished(storFile, draft.slug);
            return;
        }
    }

    await undoFileLocal(storFile, draft.kind === 'on' ? false : removeProject);
}

/** One restore for every file. Callers that loop extensions or a folder use this, not one undo per file. */
export async function undoFiles(files: readonly mls.stor.IFileInfo[]): Promise<void> {
    const present = files.filter((file) => Boolean(file));
    if (present.length === 0) return;
    const project = present[0].project;
    const same = present.filter((file) => file.project === project);
    if (same.length !== present.length) {
        console.error('[undoFile] undoFiles was given files from more than one project');
    }
    const draft = await draftUndoMode(project);
    if (draft.kind === 'broken') {
        showUndoError('driver', draft.detail);
        return;
    }
    if (draft.kind === 'on') {
        const { draftUndoBrowserOnly } = await import('/_102033_/l2/cbe/studioDraftFiles.js');
        if (!draftUndoBrowserOnly()) {
            await undoDraftGroup(same, draft.slug);
            return;
        }
    }
    for (const file of same) await undoFileLocal(file, false);
}

export async function undoAllFiles(storFile: mls.stor.IFileInfo): Promise<void> {
    const files: mls.stor.IFileInfo[] = [];
    for (const ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts']) {
        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);
        if (!mls.stor.files[key]) continue;
        files.push(mls.stor.files[key]);
    }
    await undoFiles(files);
    await mls.stor.localDB.removePrjInfo(storFile.project);
    const { createAllModels } = await import('/_102027_/l2/libModel.js');
    createAllModels(storFile, true, false, false)
}

async function undoFileLocal(storFile: mls.stor.IFileInfo, removeProject: boolean): Promise<void> {
    storFile.getValueInfo = undefined;

    if (storFile.status === 'nochange' && !storFile.inLocalStorage) {
        return;
    }

    if (storFile.status === 'new') {
        await deleteFileSystem(storFile);
        return;
    }

    if (storFile.status === 'deleted') {
        storFile.status = 'nochange';
    }

    if (storFile.status === 'renamed') {
        await undoFileRenamed(storFile);
        return;
    }

    if (storFile.status === 'changed') {
        storFile.status = 'nochange';
        storFile.inLocalStorage = false;
        storFile.hasError = false;
        await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
        if (storFile.isLocalVersionOutdated && storFile.newVersionRefIfOutdated) {
            storFile.versionRef = storFile.newVersionRefIfOutdated;
            storFile.isLocalVersionOutdated = false;
            storFile.newVersionRefIfOutdated = undefined;
        }
    }

    if (storFile.inLocalStorage) {
        storFile.inLocalStorage = false;
        await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
    }

    // No open model: stop here. The old undo returned before removePrjInfo.
    if (!disposeOpenModel(storFile)) return;

    if (removeProject && storFile) await mls.stor.localDB.removePrjInfo(storFile.project);
}

function disposeOpenModel(storFile: mls.stor.IFileInfo): boolean {
    const keyToModel = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    if (!mls.editor.models[keyToModel]) return false;
    const prop = mapExtUndo[storFile.extension];
    if (prop && mls.editor.models[keyToModel]?.[prop]) {
        mls.editor.models[keyToModel][prop]?.model.dispose();
        delete mls.editor.models[keyToModel][prop];
    }
    return true;
}

function draftShortPath(storFile: mls.stor.IFileInfo): string {
    const folder = storFile.folder ? `${storFile.folder}/` : '';
    return `l${storFile.level}/${folder}${storFile.shortName}${storFile.extension}`;
}

async function renamedOriginPath(storFile: mls.stor.IFileInfo): Promise<string | undefined> {
    if (storFile.status !== 'renamed') return undefined;
    const db = mls.stor.localDB as { getContentInfoOrNull?: () => Promise<mls.stor.IFileInfoValue | null | undefined> };
    const reader = db?.getContentInfoOrNull;
    if (typeof reader !== 'function') {
        console.error(`[undoFile] ${storFile.shortName}: published name is missing`);
        return undefined;
    }
    let info: mls.stor.IFileInfoValue | null | undefined;
    try {
        info = await reader();
    } catch (err) {
        console.error(`[undoFile] ${storFile.shortName}: ${undoErrorText(err)}`);
        return undefined;
    }
    if (!info?.originalProject || !info.originalShortName) {
        console.error(`[undoFile] ${storFile.shortName}: published name is missing`);
        return undefined;
    }
    if (info.originalProject !== storFile.project) {
        console.error(`[undoFile] ${storFile.shortName}: published name is in another project`);
        return undefined;
    }
    const folder = info.originalFolder || storFile.folder;
    const folderPart = folder ? `${folder}/` : '';
    return `l${storFile.level}/${folderPart}${info.originalShortName}${storFile.extension}`;
}

function fileNeedsDraftRestore(storFile: mls.stor.IFileInfo, saved: boolean): boolean {
    if (storFile.status === 'nochange' && !storFile.inLocalStorage) return true;
    if (saved) return true;
    if (storFile.inLocalStorage) return false;
    return storFile.status === 'changed' || storFile.status === 'deleted' || storFile.status === 'renamed' || storFile.status === 'new';
}

async function undoDraftGroup(files: readonly mls.stor.IFileInfo[], slug: string): Promise<void> {
    const { draftPathIsSaved, requestDraftRecount, undoDraftPaths } = await import('/_102033_/l2/cbe/studioDraftFiles.js');
    const project = files[0].project;
    const savedFiles: mls.stor.IFileInfo[] = [];
    const localFiles: mls.stor.IFileInfo[] = [];
    for (const file of files) {
        file.getValueInfo = undefined;
        if (fileNeedsDraftRestore(file, draftPathIsSaved(project, draftShortPath(file)))) savedFiles.push(file);
        else localFiles.push(file);
    }
    if (savedFiles.length === 0) {
        for (const file of localFiles) await undoFileLocal(file, false);
        if (localFiles.length > 0) requestDraftRecount(project);
        return;
    }
    const paths: string[] = [];
    for (const file of savedFiles) {
        const path = draftShortPath(file);
        if (!paths.includes(path)) paths.push(path);
        const origin = await renamedOriginPath(file);
        if (origin && !paths.includes(origin)) paths.push(origin);
    }
    try {
        await undoDraftPaths(project, slug, paths, async () => {
            for (const file of savedFiles) await clearRestoredFile(file);
            for (const file of localFiles) await undoFileLocal(file, false);
        });
    } catch (err) {
        showUndoError('restore', undoErrorText(err));
    }
}

async function clearRestoredFile(storFile: mls.stor.IFileInfo): Promise<void> {
    if (storFile.status === 'new' || storFile.status === 'renamed') {
        await deleteFileSystem(storFile);
        return;
    }
    const untouched = storFile.status === 'nochange' && !storFile.inLocalStorage;
    if (untouched) {
        disposeOpenModel(storFile);
        return;
    }
    await undoFileLocal(storFile, false);
}

function isNewNameValid(newShortName: string): boolean {
    if (newShortName.length === 0 || newShortName.length > 255) return false;
    const invalidCharacters = /[_\/{}\t\[\]\*$@#=\-+!|?,<>=.;^~º°""''``áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]/;
    return (!invalidCharacters.test(newShortName));
}

//---------AUXILIARY FUNCTIONS AND DEFINITIONS-------------

const mapExt: Record<string, keyof IRetAllFiles> = {
    '.ts': 'ts',
    '.html': 'html',
    '.less': 'less',
    '.test.ts': 'test',
    '.defs.ts': 'def'
};

const mapExtUndo: Record<string, keyof typeof mls.editor.models[string]> = {
    '.ts': 'ts',
    '.html': 'html',
    '.less': 'style',
    '.test.ts': 'test',
    '.defs.ts': 'defs'
};

export function replaceTripleslashAndTag(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, src: string) {

    const { folder, project, shortName, level, extension } = storFile;

    const oldTag = convertFileNameToTag({ folder, project, shortName });
    const newTag = convertFileNameToTag({ folder: newFolder, project: newProject, shortName: newShortName });
    const fileReference = `_${newProject}_/l${level}/${newFolder ? newFolder + '/' : ''}${newShortName}${extension}`;
    const regex = new RegExp(oldTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');


    src = src.replace(/fileReference="[^"]*"/, `fileReference="${fileReference}"`).replace(/shortName="[^"]*"/, `shortName="${newShortName}"`).replace(/project="[^"]*"/, `project="${newProject}"`).replace(/folder="[^"]*"/, `folder="${newFolder}"`);
    return src.replace(regex, newTag);

}

async function deleteFileSystem(storFile: mls.stor.IFileInfo) {

    //mls.editor.deleteModels(storFile.project, storFile.shortName, storFile.folder, true, storFile.level);
    const keyToModel = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    if (mls.editor.models[keyToModel]) {

        const prop = mapExtUndo[storFile.extension];
        if (prop && mls.editor.models[keyToModel]?.[prop]) {
            mls.editor.models[keyToModel][prop]?.model.dispose();
            delete mls.editor.models[keyToModel][prop];
        }
    }

    const keyFiles = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, storFile.extension);
    await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
    delete mls.stor.files[keyFiles];

}

async function safeCreate(param: IReqCreateStorFile, createMdl: boolean): Promise<mls.stor.IFileInfo | Error> {
    try {
        return await createStorFile(param, createMdl);
    } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
    }
}

async function safeRename(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, needCompile: boolean = true): Promise<mls.stor.IFileInfo | Error> {
    try {
        return await renameFile(storFile, newProject, newShortName, newFolder, needCompile);
    } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
    }
}

async function safeClone(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string): Promise<mls.stor.IFileInfo | Error> {
    try {
        return await cloneFile(storFile, newProject, newShortName);
    } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
    }
}

async function undoFileRenamed(storFile: mls.stor.IFileInfo) {

    if (!storFile.getValueInfo && (mls.stor.localDB as any).getContentInfoOrNull) storFile.getValueInfo = (mls.stor.localDB as any).getContentInfoOrNull

    const info = storFile.getValueInfo ? await storFile.getValueInfo() : {} as mls.stor.IFileInfoValue;

    if (!info.originalProject || !info.originalShortName)
        throw new Error('[undoFileRenamed] Not found info base for rename');

    const originalKey = mls.stor.getKeyToFiles(info.originalProject, storFile.level, info.originalShortName, info.originalFolder || storFile.folder, storFile.extension);

    const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, storFile.extension);

    if (!mls.stor.files[originalKey]) {
        const params = {
            project: info.originalProject,
            level: storFile.level,
            shortName: info.originalShortName,
            extension: storFile.extension,
            versionRef: '0',
            folder: info.originalFolder || storFile.folder
        };
        await mls.stor.addOrUpdateFile(params);
    }

    if (mls.stor.files[key]) {
        await mls.stor.localStor.setContent(mls.stor.files[key], { contentType: 'string', content: null });
        delete mls.stor.files[key];
    }
}

// Draft undo restores the path on the server, then drops the browser copy.
// Disposing the open model is safe after that: the next read is the published file.

const UNDO_TEXT = {
    en: {
        read: 'Could not read the published version.',
        save: 'Could not write the published version to the draft.',
        restore: 'Could not restore the published version.',
        main: 'The published commit is unknown, so the file stays as it is.',
        name: 'The published name is missing, so the file stays as it is.',
        driver: 'The draft driver failed, so the file stays as it is.',
    },
    pt: {
        read: 'Não foi possível ler a versão publicada.',
        save: 'Não foi possível gravar a versão publicada no rascunho.',
        restore: 'Não foi possível restaurar a versão publicada.',
        main: 'O commit publicado é desconhecido, então o arquivo permanece como está.',
        name: 'O nome publicado está ausente, então o arquivo permanece como está.',
        driver: 'O driver do rascunho falhou, então o arquivo permanece como está.',
    },
} as const;

type UndoErrorKey = keyof typeof UNDO_TEXT.en;

interface DraftHistoryDriver {
    driverVersion?: string;
    getHistoryContent(fileInfo: mls.stor.IFileInfo, ref: string): Promise<string | null>;
}

type DraftUndoMode =
    | { kind: 'off' }
    | { kind: 'on'; driver: DraftHistoryDriver; slug: string }
    | { kind: 'broken'; detail: string };

function undoErrorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function undoSentence(key: UndoErrorKey): string {
    const raw = typeof document === 'undefined' ? 'en' : (document.documentElement?.lang || 'en');
    const lang = raw.toLowerCase().startsWith('pt') ? 'pt' : 'en';
    return UNDO_TEXT[lang][key];
}

function showUndoError(key: UndoErrorKey, detail: string): void {
    const sentence = undoSentence(key);
    console.error(`[undoFile] ${sentence} ${detail}`);
    const screen = (globalThis as { collabMessages?: { add?: (msg: string, type: string) => void } }).collabMessages;
    if (!screen || typeof screen.add !== 'function') {
        console.error('[undoFile] collabMessages is missing; the error stayed off the screen');
        return;
    }
    screen.add(sentence, 'error');
}

function isDraftHistoryDriver(value: unknown): value is DraftHistoryDriver {
    if (typeof value !== 'object' || value === null) return false;
    return typeof (value as { getHistoryContent?: unknown }).getHistoryContent === 'function';
}

type SiteMode = 'studio' | 'production';

function siteMode(): SiteMode | undefined {
    const getMode = (mls.sites as { getMode?: () => SiteMode | undefined } | undefined)?.getMode;
    return typeof getMode === 'function' ? getMode() : undefined;
}

async function draftUndoMode(project: number): Promise<DraftUndoMode> {
    // Production, or a host that never registered getMode: keep the pre-draft undo.
    // Do not import the studio module (this file also runs in the collabmsg host,
    // which has no studio bundle).
    if (siteMode() !== 'studio') return { kind: 'off' };
    try {
        const { activeDraft, isVmDriver, modeState } = await import('/_102033_/l2/cbe/studioDraft.js');
        const draft = activeDraft();
        if (!draft) {
            console.error('[undoFile] studio mode has no active draft');
            return { kind: 'off' };
        }
        const studioProject = modeState().project;
        if (typeof studioProject !== 'number') {
            console.error('[undoFile] studio mode has no project');
            return { kind: 'off' };
        }
        // A library file is not in this site's draft. Undo drops the local copy.
        if (project !== studioProject) return { kind: 'off' };
        const others = (mls.stor as { others?: { getDefaultDriver?: (project: number) => unknown } }).others;
        if (!others || typeof others.getDefaultDriver !== 'function') {
            return { kind: 'broken', detail: 'getDefaultDriver is missing' };
        }
        const driver = await others.getDefaultDriver(project);
        if (!isVmDriver(driver as { driverVersion?: string } | null | undefined)) return { kind: 'off' };
        if (!isDraftHistoryDriver(driver)) return { kind: 'broken', detail: 'getHistoryContent is missing' };
        return { kind: 'on', driver, slug: draft };
    } catch (err) {
        return { kind: 'broken', detail: undoErrorText(err) };
    }
}

async function undoFilePublished(storFile: mls.stor.IFileInfo, slug: string): Promise<void> {
    await undoDraftGroup([storFile], slug);
}

//---------INTERFACE---------
export interface IReqCreateAllFiles {
    shortName: string,
    project: number,
    folder: string,
    enhancement: string,
    level: number,
    tsSource?: string,
    htmlSource?: string,
    lessSource?: string,
    testSource?: string,
    defsSource?: string,
}

export interface IReqCreateStorFile {
    shortName: string,
    project: number,
    folder: string,
    level: number,
    source: string,
    extension: string,
    status?: mls.stor.IFileInfoStatus,
    fileInfo?: {
        originalFolder: string;
        originalProject: number;
        originalShortName: string;
    }
}

export interface IRetAllFiles {
    ts?: mls.stor.IFileInfo | undefined | Error,
    html?: mls.stor.IFileInfo | undefined | Error,
    less?: mls.stor.IFileInfo | undefined | Error,
    def?: mls.stor.IFileInfo | undefined | Error,
    test?: mls.stor.IFileInfo | undefined | Error,
}
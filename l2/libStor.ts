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

    storFile.getValueInfo = undefined;

    if (storFile.status === 'nochange' && !storFile.inLocalStorage) {
        return;
    }

    const draft = await draftUndoMode(storFile.project);
    if (draft.kind === 'broken') {
        showUndoError('driver', draft.detail);
        return;
    }
    if (draft.kind === 'on') {
        await undoFilePublished(storFile, draft.driver);
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

    const keyToModel = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    if (!mls.editor.models[keyToModel]) return;

    const prop = mapExtUndo[storFile.extension];
    if (prop && mls.editor.models[keyToModel]?.[prop]) {
        mls.editor.models[keyToModel][prop]?.model.dispose();
        delete mls.editor.models[keyToModel][prop];
    }

    if (removeProject && storFile) await mls.stor.localDB.removePrjInfo(storFile.project);

}

export async function undoAllFiles(storFile: mls.stor.IFileInfo): Promise<void> {

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;
        await undoFile(mls.stor.files[key], false);

    }

    await mls.stor.localDB.removePrjInfo(storFile.project);
    const { createAllModels } = await import('/_102027_/l2/libModel.js');
    createAllModels(storFile, true, false, false)
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

// Draft undo restores the published blob. The open Monaco model keeps that text;
// disposing it (the non-draft path) would show the draft again on the next read.

const UNDO_TEXT = {
    en: {
        read: 'Could not read the published version.',
        save: 'Could not write the published version to the draft.',
        main: 'The published commit is unknown, so the file stays as it is.',
        name: 'The published name is missing, so the file stays as it is.',
        driver: 'The draft driver failed, so the file stays as it is.',
    },
    pt: {
        read: 'Não foi possível ler a versão publicada.',
        save: 'Não foi possível gravar a versão publicada no rascunho.',
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
    | { kind: 'on'; driver: DraftHistoryDriver }
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
        const { activeDraft, isVmDriver } = await import('/_102033_/l2/cbe/studioDraft.js');
        const draft = activeDraft();
        if (!draft) {
            console.error('[undoFile] studio mode has no active draft');
            return { kind: 'off' };
        }
        const others = (mls.stor as { others?: { getDefaultDriver?: (project: number) => unknown } }).others;
        if (!others || typeof others.getDefaultDriver !== 'function') {
            return { kind: 'broken', detail: 'getDefaultDriver is missing' };
        }
        const driver = await others.getDefaultDriver(project);
        if (!isVmDriver(driver as { driverVersion?: string } | null | undefined)) return { kind: 'off' };
        if (!isDraftHistoryDriver(driver)) return { kind: 'broken', detail: 'getHistoryContent is missing' };
        return { kind: 'on', driver };
    } catch (err) {
        return { kind: 'broken', detail: undoErrorText(err) };
    }
}

async function publishedText(driver: DraftHistoryDriver, fileInfo: mls.stor.IFileInfo, main: string): Promise<string | undefined> {
    let content: string | null;
    try {
        content = await driver.getHistoryContent(fileInfo, main);
    } catch (err) {
        showUndoError('read', undoErrorText(err));
        return undefined;
    }
    if (typeof content !== 'string') {
        showUndoError('read', 'getHistoryContent returned nothing');
        return undefined;
    }
    return content;
}

function contentsRejected(result: unknown): boolean {
    if (result === false || result === undefined || result === null) return true;
    if (!Array.isArray(result)) return false;
    return result.some((row) => {
        if (typeof row !== 'object' || row === null) return false;
        return (row as { result?: unknown }).result === false;
    });
}

async function saveDraftContents(files: mls.stor.IFileInfo[]): Promise<boolean> {
    if (typeof mls.stor.setContents !== 'function') {
        showUndoError('save', 'setContents is missing');
        return false;
    }
    try {
        const saved = await mls.stor.setContents(files, null);
        if (contentsRejected(saved)) {
            showUndoError('save', 'setContents rejected the write');
            return false;
        }
        return true;
    } catch (err) {
        showUndoError('save', undoErrorText(err));
        return false;
    }
}

function fileKeyOf(storFile: mls.stor.IFileInfo): string {
    return mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, storFile.extension);
}

async function putPublishedContent(storFile: mls.stor.IFileInfo, published: string): Promise<void> {
    const value: mls.stor.IFileInfoValue = { contentType: 'string', content: published };
    storFile.inLocalStorage = true;
    await mls.stor.localStor.setContent(storFile, value);
    storFile.getValueInfo = () => Promise.resolve(value);
    // `deleted` would make setContents remove the path. A write needs any other status.
    storFile.status = 'changed';
}

function finishPublished(storFile: mls.stor.IFileInfo): void {
    storFile.status = 'nochange';
    storFile.inLocalStorage = false;
    storFile.hasError = false;
}

async function showPublished(storFile: mls.stor.IFileInfo, published: string): Promise<void> {
    let crcSrc = published;
    if (storFile.extension === '.less') {
        try {
            const { removeTokensFromSource } = await import('/_102027_/l2/libCompileStyle.js');
            crcSrc = removeTokensFromSource(published).trim();
        } catch (err) {
            console.error(`[undoFile] less crc: ${undoErrorText(err)}`);
        }
    }
    const key = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    const bucket = mls.editor.models[key];
    if (!bucket) return;
    const prop = mapExtUndo[storFile.extension];
    const slot = prop ? bucket[prop] : undefined;
    if (!slot?.model || typeof slot.model.setValue !== 'function') {
        console.error(`[undoFile] ${storFile.shortName}: open model has no setValue`);
        return;
    }
    slot.model.setValue(published);
    if (typeof mls.common?.crc?.crc32 === 'function') slot.originalCRC = mls.common.crc.crc32(crcSrc).toString(16);
}

async function undoFilePublished(storFile: mls.stor.IFileInfo, driver: DraftHistoryDriver): Promise<void> {
    const { draftPublishedCommit } = await import('/_102033_/l2/cbe/studioDraftFiles.js');
    const main = draftPublishedCommit();
    if (!main) {
        showUndoError('main', 'draftDiff did not store main');
        return;
    }
    if (storFile.status === 'new') {
        const previous = storFile.status;
        storFile.status = 'deleted';
        const saved = await saveDraftContents([storFile]);
        if (!saved) {
            storFile.status = previous;
            return;
        }
        await deleteFileSystem(storFile);
        return;
    }
    if (storFile.status === 'renamed') {
        await undoPublishedRenamed(storFile, driver, main);
        return;
    }
    const published = await publishedText(driver, storFile, main);
    if (published === undefined) return;
    const key = fileKeyOf(storFile);
    const wasIn = Object.prototype.hasOwnProperty.call(mls.stor.files, key);
    const previous = storFile.status;
    mls.stor.files[key] = storFile;
    await putPublishedContent(storFile, published);
    const saved = await saveDraftContents([storFile]);
    if (!saved) {
        storFile.status = previous;
        if (!wasIn) delete mls.stor.files[key];
        return;
    }
    await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
    finishPublished(storFile);
    await showPublished(storFile, published);
}

function publishedOrigin(storFile: mls.stor.IFileInfo): Promise<mls.stor.IFileInfoValue> {
    const db = mls.stor.localDB as { getContentInfoOrNull?: unknown };
    const reader = db?.getContentInfoOrNull;
    if (!storFile.getValueInfo && typeof reader === 'function') {
        storFile.getValueInfo = reader as mls.stor.IFileInfo['getValueInfo'];
    }
    return storFile.getValueInfo ? storFile.getValueInfo() : Promise.resolve({} as mls.stor.IFileInfoValue);
}

async function undoPublishedRenamed(storFile: mls.stor.IFileInfo, driver: DraftHistoryDriver, main: string): Promise<void> {
    const info = await publishedOrigin(storFile);
    if (!info.originalProject || !info.originalShortName) {
        showUndoError('name', storFile.shortName);
        return;
    }
    const originalFolder = info.originalFolder || storFile.folder;
    const originalKey = mls.stor.getKeyToFiles(info.originalProject, storFile.level, info.originalShortName, originalFolder, storFile.extension);
    const probe: mls.stor.IFileInfo = {
        ...storFile,
        project: info.originalProject,
        shortName: info.originalShortName,
        folder: originalFolder,
        status: 'changed',
    };
    const published = await publishedText(driver, probe, main);
    if (published === undefined) return;

    const existed = Boolean(mls.stor.files[originalKey]);
    if (!existed) {
        const created = await mls.stor.addOrUpdateFile({
            project: info.originalProject,
            level: storFile.level,
            shortName: info.originalShortName,
            extension: storFile.extension,
            versionRef: '0',
            folder: originalFolder,
        });
        if (!created && !mls.stor.files[originalKey]) {
            showUndoError('save', 'addOrUpdateFile did not restore the published name');
            return;
        }
    }
    const original = mls.stor.files[originalKey] ?? probe;
    await putPublishedContent(original, published);
    const previous = storFile.status;
    storFile.status = 'deleted';
    const saved = await saveDraftContents(original.project === storFile.project ? [original, storFile] : [original]);
    if (!saved) {
        storFile.status = previous;
        if (!existed) delete mls.stor.files[originalKey];
        return;
    }
    if (original.project !== storFile.project) {
        const removed = await saveDraftContents([storFile]);
        if (!removed) {
            storFile.status = previous;
            return;
        }
    }
    await mls.stor.localStor.setContent(original, { contentType: 'string', content: null });
    finishPublished(original);
    await showPublished(original, published);
    await showPublished(storFile, published);
    const newKey = fileKeyOf(storFile);
    if (newKey !== originalKey && mls.stor.files[newKey]) {
        await mls.stor.localStor.setContent(mls.stor.files[newKey], { contentType: 'string', content: null });
        delete mls.stor.files[newKey];
    }
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
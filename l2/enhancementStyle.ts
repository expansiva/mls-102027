/// <mls fileReference="_102027_/l2/enhancementStyle.ts" enhancement="_blank"/>


import { convertFileNameToTag } from '/_102027_/l2/utils.js'
import { getCssWithoutTag } from '/_102027_/l2/processCssLit.js'
import { removeTokensFromSource, removeCommentLines } from '/_102027_/l2/libCompileStyle.js';

export const requires: mls.l2.enhancement.IRequire[] = [];

export const onAfterChange = (models: mls.editor.IModels) => {

    const modelStyle: mls.editor.IModelStyle | undefined = models.style;
    if (!modelStyle) return '';
    try {
        validateStyle(modelStyle);
        return '';
    } catch (e: any) {
        throw new Error(e)
    }
};

export const onAfterMarkersChange = (models: mls.editor.IModels) => {
    const modelStyle: mls.editor.IModelStyle | undefined = models.style;
    if (!modelStyle) return '';
    try {
        verifyMarkersError(modelStyle);
        return '';
    } catch (e: any) {
        throw new Error(e)
    }
};

export const onAfterCompile = async (modelStyle: mls.editor.IModelStyle): Promise<void> => {
    return;
}

export const getDesignDetails = (modelStyle: mls.editor.IModelStyle): Promise<mls.l2.enhancement.IDesignDetailsReturn> => {
    return new Promise<mls.l2.enhancement.IDesignDetailsReturn>((resolve, reject) => {
        try {
            const ret = {} as mls.l2.enhancement.IDesignDetailsReturn;
            resolve(ret);
        } catch (e) {
            reject(e);
        }
    })
}

export async function verifyMarkersError(modelStyle: mls.editor.IModelStyle) {
    if (modelStyle && modelStyle.model) {
        const markers = monaco.editor.getModelMarkers({ resource: modelStyle.model.uri });
        const hasError = markers.some(marker => marker.severity === monaco.MarkerSeverity.Error);
        modelStyle.storFile.hasError = hasError;
    }
}

export async function validateStyle(modelStyle: mls.editor.IModelStyle) {

    const model: monaco.editor.ITextModel = modelStyle.model;
    const { project, shortName, folder } = modelStyle.storFile;
    const keyToStorFileLess = mls.stor.getKeyToFiles(project, 2, shortName, folder, '.less');
    const storFileLess = mls.stor.files[keyToStorFileLess];
    if (!model || !storFileLess) return;

    storFileLess.hasError = false;
    const formated = await formatTextInMemory(model);
    let text = removeTokensFromSource(formated);
    text = removeCommentLines(text);

    const markers: monaco.Position[] = [];
    const fileName = `_${project}_${shortName}`;
    const tagName = convertFileNameToTag({project, shortName, folder});
    const nav3MenuSelector = `collab-nav-3-service[data-service="${fileName}"]`
    const rootSelectorRegex = /^[^\s].*?{/gm;
    const errors: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = rootSelectorRegex.exec(text)) !== null) {
        const selector = match[0].trim().replace(/\{$/, "").trim();
        const isValid =
            selector === nav3MenuSelector ||
            selector === tagName ||
            new RegExp(`^${tagName}\\.[a-zA-Z0-9_-]+$`).test(selector);
        if (!isValid) {
            const position = getLineSelectorByText(model, selector);
            if (position) markers.push(position);
            errors.push(`Invalid root selector: "${selector}"`);
        }
    }

    if (markers.length > 0 || ( modelStyle.styleResults && modelStyle.styleResults.errors.length > 0)) storFileLess.hasError = true;
    setErrorOnEditor(markers, model, tagName);
}

async function formatTextInMemory(model: monaco.editor.ITextModel) {

    const tempModel = monaco.editor.createModel(model.getValue(), 'less');
    const tempEditor = monaco.editor.create(document.createElement("div"), {
        model: tempModel,
    });

    try {
        await tempEditor.getAction('editor.action.formatDocument')?.run();
        const formattedText = tempModel.getValue();
        return formattedText;
    } finally {
        tempEditor.dispose();
    }
}

function setErrorOnEditor(position: monaco.Position[], model: monaco.editor.ITextModel, tag: string) {
    monaco.editor.setModelMarkers(model, 'markerSource', []);
    const markers: monaco.editor.IMarkerData[] = [];
    position.forEach((pos) => {
        const markerOptions = {
            severity: monaco.MarkerSeverity.Error,
            message: `Invalid selector, must starting with tag or tag.class ex: '${tag} {' or '${tag}.myclass {'`,
            startLineNumber: pos.lineNumber,
            startColumn: pos.column,
            endLineNumber: pos.lineNumber,
            endColumn: pos.column,
        };
        markers.push(markerOptions);
    })
    monaco.editor.setModelMarkers(model, 'markerSource', markers);
}

export function getLineByText(model: monaco.editor.ITextModel, searchText: string) {
    const lineCount = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        if (lineContent.trim() === searchText) {
            return new monaco.Position(lineNumber, 1);
        }
    }
    return null;
}

export function getLineSelectorByText(model: monaco.editor.ITextModel, searchText: string) {
    const lineCount = model.getLineCount();
    const s1 = searchText + '{';
    const s2 = s1.replace(/\s+/g, '');
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        const ln = lineContent.replace(/\s+/g, '').trim();
        if (ln === s2) {
            return new monaco.Position(lineNumber, 1);
        }
    }
    return null;
}

export function getRootSelectors(lessContent: string): string[] {
    const rootSelectors = [];
    const regex = /^([^\s{]+(?:\.[^\s{]+)*(?:\s+[^\s{]+)*)\s*\{/gm;
    let match;
    while ((match = regex.exec(lessContent)) !== null) {
        rootSelectors.push((match[1].trim().replace(/\n/g, ' ').replace(/}/g, '') + ' {').trim());
    }
    return rootSelectors;
}

export function isCommentLine(line: string) {
    if (!line) return false;
    if (line.trim().startsWith('//')) {
        return true;
    }
    return line.trim().startsWith('/*') && line.trim().endsWith('*/');
}

export async function setStylesProcessed(newCss: string, el: HTMLElement, tag: string) {
    const cssWithoutTag = getCssWithoutTag(newCss, tag);
    if (!el.shadowRoot) return;
    const stylesheet = createStyleSheet(cssWithoutTag, el.ownerDocument.defaultView!);
    if (!stylesheet) return;
    el.shadowRoot.adoptedStyleSheets = [stylesheet];
    (el as any).requestUpdate();
}

function createStyleSheet(cssString: string, defaultView: Window) {
    const sheet = (new (defaultView as any).CSSStyleSheet() as any);
    sheet.replaceSync(cssString);
    return sheet;
}

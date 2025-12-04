/// <mls shortName="enhancementLit" project="102027" enhancement="_blank" />

import { convertFileNameToTag } from './_100554_utilsLit'
import { getPropierties } from './_100554_propiertiesLit'
import { getComponentDependencies } from './_100554_dependenciesLit'
import { validateTagName, validateRender } from './_100554_validateLit'
import { setCodeLens } from './_100554_codeLensLit'
import { injectStyle } from './_100554_processCssLit'

export const requires: mls.l2.enhancement.IRequire[] = [
    {
        type: 'tspath',
        name: 'lit',
        ref: "file://server/_102027_litElement.ts"
    },
    {
        type: 'tspath',
        name: 'lit/decorators.js',
        ref: "file://server/_102027_decorators.ts"
    },
    {
        type: "cdn",
        name: "lit",
        ref: "https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js",

    },
    {
        type: "cdn",
        name: "lit/decorators.js",
        ref: "https://cdn.jsdelivr.net/npm/lit@3.0.0/decorators/+esm",

    }
];

export const getDefaultHtmlExamplePreview = (modelTS: mls.editor.IModelTS): string => {
    const { project, shortName, folder } = modelTS.storFile;
    const tag = convertFileNameToTag({ project, shortName, folder });
    return `<${tag}></${tag}>`;
}

export const getDesignDetails = (modelTS: mls.editor.IModelTS): Promise<mls.l2.enhancement.IDesignDetailsReturn> => {
    return new Promise<mls.l2.enhancement.IDesignDetailsReturn>((resolve, reject) => {
        try {
            const ret = {} as mls.l2.enhancement.IDesignDetailsReturn;
            ret.defaultHtmlExamplePreview = getDefaultHtmlExamplePreview(modelTS);
            ret.properties = getPropierties(modelTS);
            ret.webComponentDependencies = getComponentDependencies(modelTS);
            (ret as any)['servicePreviewDefault'] = '_100529_service_preview';
            resolve(ret);
        } catch (e) {
            reject(e);
        }
    })
}

export const onAfterChange = async (modelTS: mls.editor.IModelTS): Promise<void> => {


    try {
        setCodeLens(modelTS);
        if (validateTagName(modelTS)) {
            mls.events.fireFileAction('statusOrErrorChanged', modelTS.storFile, 'left');
            mls.events.fireFileAction('statusOrErrorChanged', modelTS.storFile, 'right');
            return;
        }

        if (validateRender(modelTS)) {
            mls.events.fireFileAction('statusOrErrorChanged', modelTS.storFile, 'left');
            mls.events.fireFileAction('statusOrErrorChanged', modelTS.storFile, 'right');
            return;
        }
    } catch (e: any) {
        return e.message || e;
    }
};


export const onAfterCompile = async (modelTS: mls.editor.IModelTS): Promise<void> => {
    await injectStyle(modelTS, 'Default');
    return;
}

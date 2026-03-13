/// <mls fileReference="_102027_/l2/previewBase.ts" enhancement="_blank"/>

export abstract class PreviewModeBase {

    protected level: string | undefined;
    protected iFrame: HTMLIFrameElement | undefined;
    protected isService: boolean = false;
    protected storFile: mls.stor.IFileInfo | undefined = undefined;
    
    constructor(
        _iFrame: HTMLIFrameElement,
        _level: string,
        _isService: boolean,
        _storFile: mls.stor.IFileInfo,
    ) {

        this.iFrame = _iFrame;
        this.level = _level;
        this.isService = _isService;
        this.storFile = _storFile;
    }

    protected abstract init(): Promise<void>;
}
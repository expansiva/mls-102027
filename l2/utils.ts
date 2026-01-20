/// <mls shortName="utils" project="102027" enhancement="_blank" />

export function convertTagToFileName(tag: string): {
    shortName: string;
    project: number;
    folder: string;
} | undefined {
    const parts = tag.split('--');
    const namePart = parts.pop() || '';
    const folder = parts.join('/').replace(/-(.)/g, (_, letter) => letter.toUpperCase());

    const regex = /(.+)-(\d+)$/;
    const match = namePart.match(regex);

    if (!match) return;

    const [, rest, number] = match;
    const shortName = rest.replace(/-(.)/g, (_, letter) => letter.toUpperCase());

    return {
        shortName,
        project: +number,
        folder
    };
}

export function convertFileNameToTag(info: {
    shortName: string;
    project: number;
    folder?: string;
}): string {
    const { shortName, project, folder = '' } = info;

    const kebabName = shortName.replace(/([A-Z])/g, '-$1').toLowerCase();
    const baseName = `${kebabName}-${project}`;
    const folderPrefix = folder ? folder.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/\//g, '--') + '--' : '';

    return `${folderPrefix}${baseName}`;
}


export function setErrorOnModel(model: monaco.editor.ITextModel, line: number, startColumn: number, endColumn: number, message: string, severity: monaco.MarkerSeverity): void {
    const lineIndent = getLineIndent(model, line)
    const markerOptions = {
        severity,
        message,
        startLineNumber: line,
        startColumn: startColumn + lineIndent,
        endLineNumber: line,
        endColumn: endColumn + lineIndent,
    };
    monaco.editor.setModelMarkers(model, 'markerSource', [markerOptions]);
}

function getLineIndent(model: monaco.editor.ITextModel, lineNumber: number): number {
    if (model) {
        var lineContent = model.getLineContent(lineNumber);
        var match = lineContent.match(/^\s*/);
        return match ? match[0].length : 0;
    }
    return 0;
}



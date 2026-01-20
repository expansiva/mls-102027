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


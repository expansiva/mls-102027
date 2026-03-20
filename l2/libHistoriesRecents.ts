/// <mls fileReference="_102027_/l2/libHistoriesRecents.ts" enhancement="_blank"/>

const localStorageHistoryKeyPrefix = 'mlsInfoHistoryL';

function getStorageKey(): string {
    return localStorageHistoryKeyPrefix + mls.actualLevel;
}

function loadHistory(): HistoryList {
    const info = localStorage.getItem(getStorageKey());
    return info ? JSON.parse(info) : [];
}

function saveHistory(history: HistoryList): void {
    localStorage.setItem(getStorageKey(), JSON.stringify(history));
}

function isSameFile(a: HistoryItem, b: HistoryItem): boolean {
    return (
        a.project === b.project &&
        a.shortName === b.shortName &&
        a.folder === b.folder
    );
}

export function addInHistory(file: mls.stor.IFileInfo): void {
    const history = loadHistory();

    const newItem: HistoryItem = {
        project: file.project,
        shortName: file.shortName,
        extension: file.extension,
        folder: file.folder,
    };

    let idx = -1;
    history.forEach((i: any, index) => {
        if (i.project !== file.project || i.shortName !== file.shortName || i.folder !== file.folder) return;
        idx = index;
    });

    if (idx >= 0) history.splice(idx, 1);
    history.unshift(newItem);

    if (history.length > 10) {
        for (let i = history.length - 1; i >= 0; i--) {
            if (history.length <= 10) break;
            history.splice(i, 1);
        }
    }

    saveHistory(history);

}

export function getHistory(): HistoryList {
    return loadHistory();
}

export function removeFromHistory(target: HistoryItem): void {
    const history = loadHistory();
    const updated = history.filter(item => !isSameFile(item, target));
    saveHistory(updated);
}

export function renameHistoryItem(
    target: HistoryItem,
    newShortName: string
): void {
    const history = loadHistory();

    const updated = history.map(item => {
        if (isSameFile(item, target)) {
            return {
                ...item,
                shortName: newShortName,
            };
        }
        return item;
    });

    saveHistory(updated);
}

// Recents Projects

const localStorageHistoryKeyProject = 'serviceExploreProjects';

export function loadProjectHistory(): IHistoryProject[] {
    const lcHistory = localStorage.getItem(localStorageHistoryKeyProject);
    let rc: IHistoryProject[] = [];
    if (!lcHistory) return rc;
    try {
        rc = JSON.parse(lcHistory);
    } catch (err) {
        throw new Error('Error on load l5 project history');
    }
    return rc;
}

export function saveProjectHistory(history: IHistoryProject[]): void {
    localStorage.setItem(localStorageHistoryKeyProject, JSON.stringify(history));
}

export function removeProjectFromHistory(projectId: number): void {
    const history = loadProjectHistory();
    const updated = history.filter(item => item.project !== projectId);
    saveProjectHistory(updated);
}

export function renameProjectInHistory(
    projectId: number,
    newName: string
): void {
    const history = loadProjectHistory();

    const updated = history.map(item => {
        if (item.project === projectId) {
            return {
                ...item,
                name: newName
            };
        }
        return item;
    });

    saveProjectHistory(updated);
}

interface IHistoryProject {
    project: number,
    name: string,
    doSelect: boolean,
}


export interface HistoryItem {
    project: number;
    shortName: string;
    extension: string;
    folder: string;
}

type HistoryList = HistoryItem[];


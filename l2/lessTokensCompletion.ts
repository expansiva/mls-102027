/// <mls fileReference="_102027_/l2/lessTokensCompletion.ts" enhancement="_blank" />

// Design-system tokens as Monaco intellisense for `.less` files: completion on `@` and hover on a
// token reference. This is what lets a `.less` use `@page-bg` WITHOUT carrying the
// `//Start Less Tokens ... //End Less Tokens` block — that block only ever existed to feed the
// editor (every compile path strips it and reads the tokens from the design system, see
// libCompileStyle).
//
// Freshness: the token list is read INSIDE each request, never cached here. `collabImport` treats
// `designSystem` as a special case (skips its module registry and cache-busts the URL with
// `?t=Date.now()` while the file is being edited), so a token added to the design system shows up
// without reloading the editor and without re-registering the provider.

import { getTokens } from '/_102027_/l2/designSystemBase.js';

/** The theme the `.less` pipeline compiles against (same constant the compile paths use). */
const THEME = 'Default';

type TokenSection = 'color' | 'typography' | 'global';

interface TokenEntry {
    name: string;
    value: string;
    section: TokenSection;
}

// Sections are listed in this order in the suggestion list.
const SECTION_ORDER: Record<TokenSection, string> = { color: '1', typography: '2', global: '3' };

/** A `@token` reference: word characters and dashes after the `@`. */
const TOKEN_REF = /@[\w-]+/g;
/** The `@token` being typed, anchored at the cursor. */
const TOKEN_TYPING = /@[\w-]*$/;

/**
 * Project of the file being edited — resolved from the MODEL, never from `mls.actualProject`:
 * a split screen can hold two files of two different projects, each with its own design system.
 */
function projectOfModel(model: monaco.editor.ITextModel): number | null {
    try {
        const mmodel = mls.editor.getModelById(model.id);
        return mmodel?.storFile?.project ?? null;
    } catch {
        return null;
    }
}

/** Flat token list of a project's theme. `_dark-` keys are skipped: they are not Less variables. */
async function tokensOf(project: number): Promise<TokenEntry[]> {
    let themes: any[] = [];
    try {
        themes = await getTokens(project);
    } catch {
        return [];
    }
    const theme = themes.find(t => t?.themeName === THEME) ?? themes[0];
    if (!theme) return [];

    const out: TokenEntry[] = [];
    const collect = (map: Record<string, string> | undefined, section: TokenSection) => {
        for (const [name, value] of Object.entries(map ?? {})) {
            if (name.startsWith('_dark-')) continue;
            out.push({ name, value, section });
        }
    };
    collect(theme.color, 'color');
    collect(theme.typography, 'typography');
    collect(theme.global, 'global');
    return out;
}

/** The `@token` reference under `column` (1-based), or null. Exported for testing. */
export function tokenAt(line: string, column: number): { name: string; start: number; end: number } | null {
    TOKEN_REF.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_REF.exec(line)) !== null) {
        const start = match.index + 1;            // 1-based start column of '@'
        const end = start + match[0].length;      // exclusive
        if (column >= start && column < end) return { name: match[0].slice(1), start, end };
    }
    return null;
}

const completionProvider: monaco.languages.CompletionItemProvider = {
    triggerCharacters: ['@'],
    provideCompletionItems: async (model, position) => {
        const project = projectOfModel(model);
        if (!project) return { suggestions: [] };

        const tokens = await tokensOf(project);
        if (!tokens.length) return { suggestions: [] };

        // Replace the whole `@partial` being typed, so accepting never yields `@@token`.
        // Computed from the line instead of getWordUntilPosition: the word pattern of the css
        // language is not ours to depend on.
        const typed = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
        });
        const typing = TOKEN_TYPING.exec(typed);
        const range: monaco.IRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: typing ? position.column - typing[0].length : position.column,
            endColumn: position.column,
        };

        return {
            // Complete list: Monaco filters client-side while typing instead of calling us on
            // every keystroke — one design-system read per opened list.
            incomplete: false,
            suggestions: tokens.map(t => ({
                label: `@${t.name}`,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: `@${t.name}`,
                detail: t.value,
                documentation: `${t.section} · design system`,
                sortText: `${SECTION_ORDER[t.section]}${t.name}`,
                range,
            })),
        };
    },
};

const hoverProvider: monaco.languages.HoverProvider = {
    provideHover: async (model, position) => {
        const ref = tokenAt(model.getLineContent(position.lineNumber), position.column);
        if (!ref) return null;

        const project = projectOfModel(model);
        if (!project) return null;

        const token = (await tokensOf(project)).find(t => t.name === ref.name);
        if (!token) return null;

        return {
            range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: ref.start,
                endColumn: ref.end,
            },
            contents: [
                { value: `**@${token.name}**` },
                { value: '```less\n' + token.value + '\n```' },
                { value: `_${token.section} · design system_` },
            ],
        };
    },
};

// Module-level, NOT per instance: serviceSource is mounted twice (left and right), and every
// registerCompletionItemProvider call stacks another provider — registering per instance would
// duplicate every suggestion.
let registered: monaco.IDisposable[] | null = null;

/** Register the `.less` token providers once per page. Safe to call from every service instance. */
export function registerLessTokenProviders(): void {
    if (registered) return;
    if (typeof monaco === 'undefined' || !monaco.languages) return;
    registered = [
        monaco.languages.registerCompletionItemProvider('less', completionProvider),
        monaco.languages.registerHoverProvider('less', hoverProvider),
    ];
}

/** Undo the registration (tests / teardown). */
export function disposeLessTokenProviders(): void {
    registered?.forEach(d => d.dispose());
    registered = null;
}

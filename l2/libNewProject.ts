/// <mls fileReference="_102027_/l2/libNewProject.ts" enhancement="_blank"/>

export interface IProjectType {
  id: string;
  name: string;
  dependencies: number[];
  agent?: string;
} 

export const projectTypes: IProjectType[] = [
  {
    id: 'auraDev',
    name: 'Aura',
    dependencies: [102020, 102021, 102027, 102029, 102033, 102034],
    agent: 'agentNewSolution',
  },
  {
    id: 'landingPage',
    name: 'Landing Page',
    dependencies: [102032, 102027],
  },
  {
    id: 'workspace',
    name: 'Workspace',
    dependencies: [102027],
  },
];

export const template_tsconfig = {
    ext: '.json',
    template: `
{
    "compilerOptions": {
        "target": "es2020",
        "module": "ES2020",
        "esModuleInterop": true,
        "outDir": "./preBuild/_[project]_/",
        "rootDir": "./project/_[project]_",
        "strict": true,
        "removeComments": false,
        "noUnusedParameters": false,
        "skipLibCheck": false,
        "forceConsistentCasingInFileNames": true,
        "sourceMap": false,
        "declaration": false,
        "experimentalDecorators": true,
        "emitDecoratorMetadata": false,
        "noImplicitAny": false,
        "strictNullChecks": false,
        "paths": {
            "/_[project]_/*": [
                "./project/_[project]_/*"
            ],
            "/_102027_/*": [
                "./project/mls-102027/*"
            ]
        },
        "lib": [
            "dom",
            "ES2022"
        ]
    },
    "include": [
        "project/_[project]_/**/*",
        "monaco.d.ts",
        "mls.d.ts"
    ],
    "exclude": [
        "node_modules",
        "**/*.spec.ts",
        "l2/*.ts"
    ]
}

    `
}

export const template_l5Project = {
    ext: '.json',
    template: `
    {
        "orgName": "[org]",
        "plugins": {},
        "reasons": {},
        "services": [],
        "servicesConfigEnabled": false,
        "designSystems": [],
        "links": [],
        "languages": [
            {
                "language": "en",
                "name": "English",
                "path": "/"
            }
        ]
    }

    `
}

export const template_package = {
    ext: '.json',
    template: `
    {
        "name": "[project]",
        "version": "1.0.0",
        "description": "",
        "scripts": {
            "test": "echo \\"Error: no test specified\\" && exit 1",
            "buildCI": "node ../scripts/buildCI/buildCI.mjs [project]"
        },
        "author": "",
        "license": "ISC",
        "actionDependencies": {
            "mls-102027": "git+https://github.com/expansiva/mls-102027.git"
        }
    }
    `
}


export const template_build_old = {
    ext: '.yml',
    template: `
name: Build TypeScript

on:
  push:
    branches:
      - main
    paths:
      - 'l1/**'
      - 'l2/**'
      - 'l3/**'
      - 'l4/**'
      - 'l5/**'
      - 'l6/**'
      - 'l7/**'
      - 'README.md'
      - 'readme.md'
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '24'  # ou a versão do Node.js que você está usando

    - name: Fix package name
      run: |
        if [ -f packagelib.json ]; then
          cp packagelib.json package.json
        fi

    - name: Fix tsconfig name
      run: |
        if [ -f tsconfiglib.json ]; then
          cp tsconfiglib.json tsconfig.json
        fi
        
    - name: Install dependencies
      run: npm install

    - name: Compile CI
      run: npm run buildCI
      env:
          COLLAB_PROJECT: [project]
          COLLAB_REPO: "mls-[project]"
          COLLAB_OWNER: "mls"
          COLLAB_BRANCH: "main"
          COLLAB_DRIVER: "GitHub"
          COLLAB_TOKEN: \${{ vars.COLLAB_TOKEN }}
          
    - name: Commit compiled files
      run: |
        git config --global user.name 'github-actions[bot]'
        git config --global user.email 'github-actions[bot]@users.noreply.github.com'
        git add -f obj
        git commit -m "Compile TypeScript files"
      env:
        GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

    - name: Push changes (with friendly diff on failure)
      run: |
        git fetch origin main
        if ! git push origin main; then
          echo "Push failed. The remote repository contains changes you don't have locally."
          echo "Files that differ between your HEAD and origin/main:"
          git diff --name-only HEAD origin/main
          exit 1
        fi
      env:
        GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
    `
}

export const template_build = {
    ext: '.yml',
    template: `
name: Build no mls-base

on:
  push:
    branches: [main]
    paths: ['l1/**', 'l2/**', 'l3/**', 'l4/**', 'l5/**', 'l6/**', 'l7/**']

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    env:
      PROJECT: \${{ github.event.repository.name }}

    steps:
      - name: Checkout mls-base
        uses: actions/checkout@v4
        with:
          repository: expansiva/mls-base
          path: mls-base

      - name: Checkout projeto atual dentro do mls-base
        uses: actions/checkout@v4
        with:
          path: mls-base/\${{ github.event.repository.name }}
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install mls-base
        working-directory: mls-base
        run: pnpm install

      - name: Build
        working-directory: mls-base
        run: pnpm run buildCI "$PROJECT"
        env:
          GH_PAT: \${{ secrets.GH_PAT }}
          COLLAB_TOKEN: \${{ vars.COLLAB_TOKEN }}
          COLLAB_DRIVER: GitHub

      - name: Commit compiled files
        working-directory: mls-base
        run: |
          ID="\${PROJECT#mls-}"
          mkdir -p "\$PROJECT/obj"
          cp ".generated/\$ID/obj/compiled.zip" ".generated/$ID/obj/source.zip" "\$PROJECT/obj/"
          git -C "\$PROJECT" config user.name 'github-actions[bot]'
          git -C "\$PROJECT" config user.email 'github-actions[bot]@users.noreply.github.com'
          git -C "\$PROJECT" add -f obj
          git -C "\$PROJECT" diff --cached --quiet || git -C "\$PROJECT" commit -m "Compile TypeScript files (mls-base buildCI)"
          git -C "\$PROJECT" push
    `
}

export const template_l2Project = {
    ext: '.ts',
    template: `
/// <mls fileReference="_[project]_/l2/project.ts" enhancement="_blank" />

export const projectConfig = {
    masterFrontEnd: {
        build: '',
        start: '',
        liveView: '',
    },
    masterBackEnd: {
        build: '',
        start: '',
        serverView: ''
    },
    modules: []
}
`
}

export const template_deps = {
    ext: '.json',
    template: `
{
  "workspaceDependencies": {
    "102027": {
      "repo": "https://github.com/expansiva/mls-102027.git"
    }
  }
}
`
}

export const template_coreIndex = {
    ext: '.ts',
    template: ``
}

export const template_ds = {
    ext: '.ts',
    template: `
/// <mls fileReference="_[project]_/l2/designSystem.ts" enhancement="_102027_/l2/enhancementLit" />

import { IDesignSystemTokens } from '/_102027_/l2/designSystemBase.js';

/**
 * Project design system — ROLE-BASED token vocabulary. The canonical baseline is
 * MANDATORY_COLOR_ROLES / DEFAULT_TOKENS_TEMPLATE in _102029_/l2/designSystemBase.ts:
 * 44 colour roles, each with -hover/-focus/-disabled and a _dark- twin.
 *
 * The name says WHERE the token is used, never what colour it is. Pairs travel
 * together (button-primary-bg with button-primary-text, status-error-bg with
 * status-error-text, nav-bg with nav-text). Surfaces go page-bg > surface-bg >
 * surface-alt-bg; text on them is text-strong / text-default / text-muted.
 * Charts use chart-series-1..6 in this fixed order — the order IS the
 * colour-blindness safeguard, so never shuffle it and never invent a 7th.
 *
 * Change the values freely; do not rename or delete the keys.
 */
export const tokens: IDesignSystemTokens[] = [
    {
        themeName: "Default",
        description: "Tema padrão do projeto",
        color: {
            "page-bg": "#ffffff",
            "page-bg-hover": "#f2f2f2",
            "page-bg-focus": "#e6e6e6",
            "page-bg-disabled": "#d9d9d9",
            "surface-bg": "#ffffff",
            "surface-bg-hover": "#f2f2f2",
            "surface-bg-focus": "#e6e6e6",
            "surface-bg-disabled": "#d9d9d9",
            "surface-alt-bg": "#F9F9F9",
            "surface-alt-bg-hover": "#f4f4f4",
            "surface-alt-bg-focus": "#efefef",
            "surface-alt-bg-disabled": "#eaeaea",
            "input-bg": "#ffffff",
            "input-bg-hover": "#ededed",
            "input-bg-focus": "#dedede",
            "input-bg-disabled": "#f6f7fa",
            "text-strong": "#000000",
            "text-strong-hover": "#1a1a1a",
            "text-strong-focus": "#0d0d0d",
            "text-strong-disabled": "#262626",
            "text-default": "#403f3f",
            "text-default-hover": "#4b4a4a",
            "text-default-focus": "#353434",
            "text-default-disabled": "#525151",
            "text-muted": "#535353",
            "text-muted-hover": "#5f5f5f",
            "text-muted-focus": "#4a4a4a",
            "text-muted-disabled": "#696969",
            "border-default": "#D3D3D3",
            "border-default-hover": "#c7c7c7",
            "border-default-focus": "#bcbcbc",
            "border-default-disabled": "#e4e4e4",
            "border-subtle": "#E6E6E6",
            "border-subtle-hover": "#dadada",
            "border-subtle-focus": "#cfcfcf",
            "border-subtle-disabled": "#f0f0f0",
            "button-primary-bg": "#1890FF",
            "button-primary-bg-hover": "#1a99ff",
            "button-primary-bg-focus": "#0e80cc",
            "button-primary-bg-disabled": "#66b3ff",
            "button-primary-text": "#ffffff",
            "button-primary-text-hover": "#f2f2f2",
            "button-primary-text-focus": "#e6e6e6",
            "button-primary-text-disabled": "#d9d9d9",
            "button-secondary-bg": "#ffffff",
            "button-secondary-bg-hover": "#f2f2f2",
            "button-secondary-bg-focus": "#e6e6e6",
            "button-secondary-bg-disabled": "#d9d9d9",
            "button-secondary-text": "#403f3f",
            "button-secondary-text-hover": "#4b4a4a",
            "button-secondary-text-focus": "#353434",
            "button-secondary-text-disabled": "#525151",
            "button-secondary-border": "#D3D3D3",
            "button-secondary-border-hover": "#c7c7c7",
            "button-secondary-border-focus": "#bcbcbc",
            "button-secondary-border-disabled": "#e4e4e4",
            "button-danger-bg": "#FF4D4F",
            "button-danger-bg-hover": "#ff6666",
            "button-danger-bg-focus": "#e63e3e",
            "button-danger-bg-disabled": "#ff9999",
            "button-danger-text": "#ffffff",
            "button-danger-text-hover": "#f2f2f2",
            "button-danger-text-focus": "#e6e6e6",
            "button-danger-text-disabled": "#d9d9d9",
            "link-text": "#1890FF",
            "link-text-hover": "#1a99ff",
            "link-text-focus": "#0e80cc",
            "link-text-disabled": "#66b3ff",
            "focus-ring": "#1890FF",
            "focus-ring-hover": "#1a99ff",
            "focus-ring-focus": "#0e80cc",
            "focus-ring-disabled": "#66b3ff",
            "selected-bg": "#e3f1ff",
            "selected-bg-hover": "#d3e0ed",
            "selected-bg-focus": "#c5d2de",
            "selected-bg-disabled": "#e9f1fa",
            "selected-text": "#1890FF",
            "selected-text-hover": "#1a99ff",
            "selected-text-focus": "#0e80cc",
            "selected-text-disabled": "#66b3ff",
            "selected-border": "#1890FF",
            "selected-border-hover": "#1a99ff",
            "selected-border-focus": "#0e80cc",
            "selected-border-disabled": "#66b3ff",
            "status-success-bg": "#e2f5db",
            "status-success-bg-hover": "#d2e4cc",
            "status-success-bg-focus": "#c5d5bf",
            "status-success-bg-disabled": "#e9f3e9",
            "status-success-text": "#52C41A",
            "status-success-text-hover": "#66d93f",
            "status-success-text-focus": "#4ca610",
            "status-success-text-disabled": "#8cd78e",
            "status-error-bg": "#fde8e9",
            "status-error-bg-hover": "#ebd8d9",
            "status-error-bg-focus": "#dccacb",
            "status-error-bg-disabled": "#f5edf0",
            "status-error-text": "#FF4D4F",
            "status-error-text-hover": "#ff6666",
            "status-error-text-focus": "#e63e3e",
            "status-error-text-disabled": "#ff9999",
            "status-warning-bg": "#fcf2d7",
            "status-warning-bg-hover": "#eae1c8",
            "status-warning-bg-focus": "#dbd3bb",
            "status-warning-bg-disabled": "#f4f1e8",
            "status-warning-text": "#FAAD14",
            "status-warning-text-hover": "#fbbd34",
            "status-warning-text-focus": "#e09a0e",
            "status-warning-text-disabled": "#fdd55e",
            "status-info-bg": "#e2effc",
            "status-info-bg-hover": "#d2deea",
            "status-info-bg-focus": "#c5d0db",
            "status-info-bg-disabled": "#e9f0f8",
            "status-info-text": "#0a6dc9",
            "status-info-text-hover": "#1b7edb",
            "status-info-text-focus": "#006ab3",
            "status-info-text-disabled": "#66a8e1",
            "status-neutral-bg": "#e9edf2",
            "status-neutral-bg-hover": "#d9dce1",
            "status-neutral-bg-focus": "#cbced3",
            "status-neutral-bg-disabled": "#eceff4",
            "status-neutral-text": "#46535f",
            "status-neutral-text-hover": "#414d58",
            "status-neutral-text-focus": "#3d4853",
            "status-neutral-text-disabled": "#a2aab2",
            "nav-bg": "#1c2430",
            "nav-bg-hover": "#1a212d",
            "nav-bg-focus": "#181f2a",
            "nav-bg-disabled": "#90959c",
            "nav-text": "#c9d3df",
            "nav-text-hover": "#bbc4cf",
            "nav-text-focus": "#afb8c2",
            "nav-text-disabled": "#dde4eb",
            "nav-active-bg": "#2e3d52",
            "nav-active-bg-hover": "#2b394c",
            "nav-active-bg-focus": "#283547",
            "nav-active-bg-disabled": "#98a0ac",
            "nav-active-text": "#ffffff",
            "nav-active-text-hover": "#ededed",
            "nav-active-text-focus": "#dedede",
            "nav-active-text-disabled": "#f6f7fa",
            "overlay-backdrop-bg": "rgba(9, 14, 20, 0.55)",
            "overlay-backdrop-bg-hover": "rgba(9, 14, 20, 0.55)",
            "overlay-backdrop-bg-focus": "rgba(9, 14, 20, 0.55)",
            "overlay-backdrop-bg-disabled": "rgba(9, 14, 20, 0.55)",
            "tooltip-bg": "#1c2430",
            "tooltip-bg-hover": "#1a212d",
            "tooltip-bg-focus": "#181f2a",
            "tooltip-bg-disabled": "#90959c",
            "tooltip-text": "#f0f4f8",
            "tooltip-text-hover": "#dfe3e7",
            "tooltip-text-focus": "#d1d4d8",
            "tooltip-text-disabled": "#eff2f6",
            "chart-series-1": "#2a78d6",
            "chart-series-1-hover": "#2770c7",
            "chart-series-1-focus": "#2568ba",
            "chart-series-1-disabled": "#96bbe7",
            "chart-series-2": "#1baf7a",
            "chart-series-2-hover": "#19a371",
            "chart-series-2-focus": "#17986a",
            "chart-series-2-disabled": "#8fd3be",
            "chart-series-3": "#eda100",
            "chart-series-3-hover": "#dc9600",
            "chart-series-3-focus": "#ce8c00",
            "chart-series-3-disabled": "#eecd87",
            "chart-series-4": "#008300",
            "chart-series-4-hover": "#007a00",
            "chart-series-4-focus": "#007200",
            "chart-series-4-disabled": "#83c087",
            "chart-series-5": "#4a3aa7",
            "chart-series-5-hover": "#45369b",
            "chart-series-5-focus": "#403291",
            "chart-series-5-disabled": "#a49fd2",
            "chart-series-6": "#e34948",
            "chart-series-6-hover": "#d34443",
            "chart-series-6-focus": "#c5403f",
            "chart-series-6-disabled": "#e9a5a7",
            "_dark-page-bg": "#0d1117",
            "_dark-page-bg-hover": "#1a1f24",
            "_dark-page-bg-focus": "#0a0e13",
            "_dark-page-bg-disabled": "#2b3036",
            "_dark-surface-bg": "#0d1117",
            "_dark-surface-bg-hover": "#1a1f24",
            "_dark-surface-bg-focus": "#0a0e13",
            "_dark-surface-bg-disabled": "#2b3036",
            "_dark-surface-alt-bg": "#161b22",
            "_dark-surface-alt-bg-hover": "#1f2329",
            "_dark-surface-alt-bg-focus": "#0f1418",
            "_dark-surface-alt-bg-disabled": "#2c3238",
            "_dark-input-bg": "#10151c",
            "_dark-input-bg-hover": "#21252c",
            "_dark-input-bg-focus": "#2f333a",
            "_dark-input-bg-disabled": "#0e1319",
            "_dark-text-strong": "#FFFFFF",
            "_dark-text-strong-hover": "#f2f2f2",
            "_dark-text-strong-focus": "#e6e6e6",
            "_dark-text-strong-disabled": "#d9d9d9",
            "_dark-text-default": "#e6edf3",
            "_dark-text-default-hover": "#d1d9e4",
            "_dark-text-default-focus": "#c3cfd8",
            "_dark-text-default-disabled": "#b0b8c4",
            "_dark-text-muted": "#8d96a0",
            "_dark-text-muted-hover": "#a1aab0",
            "_dark-text-muted-focus": "#7a828a",
            "_dark-text-muted-disabled": "#b1b7bd",
            "_dark-border-default": "#6D6D6D",
            "_dark-border-default-hover": "#7b7b7b",
            "_dark-border-default-focus": "#888888",
            "_dark-border-default-disabled": "#4f4f4f",
            "_dark-border-subtle": "#575757",
            "_dark-border-subtle-hover": "#656565",
            "_dark-border-subtle-focus": "#727272",
            "_dark-border-subtle-disabled": "#3f3f3f",
            "_dark-button-primary-bg": "#0b81ef",
            "_dark-button-primary-bg-hover": "#1a95f6",
            "_dark-button-primary-bg-focus": "#0073d8",
            "_dark-button-primary-bg-disabled": "#66b3ef",
            "_dark-button-primary-text": "#ffffff",
            "_dark-button-primary-text-hover": "#f2f2f2",
            "_dark-button-primary-text-focus": "#e6e6e6",
            "_dark-button-primary-text-disabled": "#d9d9d9",
            "_dark-button-secondary-bg": "#161b22",
            "_dark-button-secondary-bg-hover": "#1f2329",
            "_dark-button-secondary-bg-focus": "#0f1418",
            "_dark-button-secondary-bg-disabled": "#2c3238",
            "_dark-button-secondary-text": "#e6edf3",
            "_dark-button-secondary-text-hover": "#d1d9e4",
            "_dark-button-secondary-text-focus": "#c3cfd8",
            "_dark-button-secondary-text-disabled": "#b0b8c4",
            "_dark-button-secondary-border": "#6D6D6D",
            "_dark-button-secondary-border-hover": "#7b7b7b",
            "_dark-button-secondary-border-focus": "#888888",
            "_dark-button-secondary-border-disabled": "#4f4f4f",
            "_dark-button-danger-bg": "#f9676a",
            "_dark-button-danger-bg-hover": "#ff7b7f",
            "_dark-button-danger-bg-focus": "#e5565e",
            "_dark-button-danger-bg-disabled": "#ff9b9e",
            "_dark-button-danger-text": "#ffffff",
            "_dark-button-danger-text-hover": "#f2f2f2",
            "_dark-button-danger-text-focus": "#e6e6e6",
            "_dark-button-danger-text-disabled": "#d9d9d9",
            "_dark-link-text": "#0b81ef",
            "_dark-link-text-hover": "#1a95f6",
            "_dark-link-text-focus": "#0073d8",
            "_dark-link-text-disabled": "#66b3ef",
            "_dark-focus-ring": "#0b81ef",
            "_dark-focus-ring-hover": "#1a95f6",
            "_dark-focus-ring-focus": "#0073d8",
            "_dark-focus-ring-disabled": "#66b3ef",
            "_dark-selected-bg": "#123351",
            "_dark-selected-bg-hover": "#23415d",
            "_dark-selected-bg-focus": "#314e68",
            "_dark-selected-bg-disabled": "#0f2031",
            "_dark-selected-text": "#0b81ef",
            "_dark-selected-text-hover": "#1a95f6",
            "_dark-selected-text-focus": "#0073d8",
            "_dark-selected-text-disabled": "#66b3ef",
            "_dark-selected-border": "#0b81ef",
            "_dark-selected-border-hover": "#1a95f6",
            "_dark-selected-border-focus": "#0073d8",
            "_dark-selected-border-disabled": "#66b3ef",
            "_dark-status-success-bg": "#1c3617",
            "_dark-status-success-bg-hover": "#2c4427",
            "_dark-status-success-bg-focus": "#3a5035",
            "_dark-status-success-bg-disabled": "#142217",
            "_dark-status-success-text": "#63d42b",
            "_dark-status-success-text-hover": "#75d93d",
            "_dark-status-success-text-focus": "#55b825",
            "_dark-status-success-text-disabled": "#8ade5f",
            "_dark-status-error-bg": "#40191b",
            "_dark-status-error-bg-hover": "#4d292b",
            "_dark-status-error-bg-focus": "#593739",
            "_dark-status-error-bg-disabled": "#241519",
            "_dark-status-error-text": "#f9676a",
            "_dark-status-error-text-hover": "#ff7b7f",
            "_dark-status-error-text-focus": "#e5565e",
            "_dark-status-error-text-disabled": "#ff9b9e",
            "_dark-status-warning-bg": "#3d3213",
            "_dark-status-warning-bg-hover": "#4b4024",
            "_dark-status-warning-bg-focus": "#564d32",
            "_dark-status-warning-bg-disabled": "#232015",
            "_dark-status-warning-text": "#eead2b",
            "_dark-status-warning-text-hover": "#f2b73d",
            "_dark-status-warning-text-focus": "#d69c1f",
            "_dark-status-warning-text-disabled": "#f5cd5c",
            "_dark-status-info-bg": "#14304d",
            "_dark-status-info-bg-hover": "#243e59",
            "_dark-status-info-bg-focus": "#334b64",
            "_dark-status-info-bg-disabled": "#101f2f",
            "_dark-status-info-text": "#0b81ef",
            "_dark-status-info-text-hover": "#1a95f6",
            "_dark-status-info-text-focus": "#0073d8",
            "_dark-status-info-text-disabled": "#66b3ef",
            "_dark-status-neutral-bg": "#2a323d",
            "_dark-status-neutral-bg-hover": "#39404b",
            "_dark-status-neutral-bg-focus": "#464d56",
            "_dark-status-neutral-bg-disabled": "#1a2028",
            "_dark-status-neutral-text": "#b0bcc9",
            "_dark-status-neutral-text-hover": "#b6c1cd",
            "_dark-status-neutral-text-focus": "#bac5d0",
            "_dark-status-neutral-text-disabled": "#565e67",
            "_dark-nav-bg": "#10151c",
            "_dark-nav-bg-hover": "#21252c",
            "_dark-nav-bg-focus": "#2f333a",
            "_dark-nav-bg-disabled": "#0e1319",
            "_dark-nav-text": "#96a3b3",
            "_dark-nav-text-hover": "#9da9b8",
            "_dark-nav-text-focus": "#a4afbd",
            "_dark-nav-text-disabled": "#4b535d",
            "_dark-nav-active-bg": "#123351",
            "_dark-nav-active-bg-hover": "#23415d",
            "_dark-nav-active-bg-focus": "#314e68",
            "_dark-nav-active-bg-disabled": "#0f2031",
            "_dark-nav-active-text": "#8ec4f8",
            "_dark-nav-active-text-hover": "#96c8f8",
            "_dark-nav-active-text-focus": "#9dccf9",
            "_dark-nav-active-text-disabled": "#47627c",
            "_dark-overlay-backdrop-bg": "rgba(0, 0, 0, 0.65)",
            "_dark-overlay-backdrop-bg-hover": "rgba(0, 0, 0, 0.65)",
            "_dark-overlay-backdrop-bg-focus": "rgba(0, 0, 0, 0.65)",
            "_dark-overlay-backdrop-bg-disabled": "rgba(0, 0, 0, 0.65)",
            "_dark-tooltip-bg": "#2a323d",
            "_dark-tooltip-bg-hover": "#39404b",
            "_dark-tooltip-bg-focus": "#464d56",
            "_dark-tooltip-bg-disabled": "#1a2028",
            "_dark-tooltip-text": "#f0f4f8",
            "_dark-tooltip-text-hover": "#f1f5f8",
            "_dark-tooltip-text-focus": "#f2f5f9",
            "_dark-tooltip-text-disabled": "#73777c",
            "_dark-chart-series-1": "#3987e5",
            "_dark-chart-series-1-hover": "#478fe7",
            "_dark-chart-series-1-focus": "#5397e8",
            "_dark-chart-series-1-disabled": "#214674",
            "_dark-chart-series-2": "#199e70",
            "_dark-chart-series-2-hover": "#29a57a",
            "_dark-chart-series-2-focus": "#37ab83",
            "_dark-chart-series-2-disabled": "#12503f",
            "_dark-chart-series-3": "#c98500",
            "_dark-chart-series-3-hover": "#cd8e12",
            "_dark-chart-series-3-focus": "#d09521",
            "_dark-chart-series-3-disabled": "#62450d",
            "_dark-chart-series-4": "#008300",
            "_dark-chart-series-4-hover": "#128c12",
            "_dark-chart-series-4-focus": "#219321",
            "_dark-chart-series-4-disabled": "#07440d",
            "_dark-chart-series-5": "#9085e9",
            "_dark-chart-series-5-hover": "#988eeb",
            "_dark-chart-series-5-focus": "#9e95ec",
            "_dark-chart-series-5-disabled": "#484575",
            "_dark-chart-series-6": "#e66767",
            "_dark-chart-series-6-hover": "#e87272",
            "_dark-chart-series-6-focus": "#e97b7b",
            "_dark-chart-series-6-disabled": "#6f383b"
        },
        global: {
            "breakpoint-small": "544px",
            "breakpoint-medium": "768px",
            "breakpoint-large": "1012px",
            "transition-slow": "0.2s",
            "transition-normal": "0.3s",
            "transition-fast": "0.5s",
            "space-base-unit": "0.25rem",
            "space-8": "calc(@space-base-unit * 2)",
            "space-16": "calc(@space-base-unit * 4)",
            "space-24": "calc(@space-base-unit * 6)",
            "space-32": "calc(@space-base-unit * 8)",
            "space-40": "calc(@space-base-unit * 10)",
            "space-48": "calc(@space-base-unit * 12)",
            "space-64": "calc(@space-base-unit * 16)",
            "radius-small": "6px",
            "radius-medium": "10px",
            "radius-large": "14px",
            "radius-pill": "999px",
            "shadow-small": "0 1px 2px rgba(15, 23, 42, 0.06)",
            "shadow-medium": "0 4px 12px rgba(15, 23, 42, 0.10)"
        },
        typography: {
            "font-base-unit": ".25rem",
            "font-family-primary": "'Charlie Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
            "font-family-secondary": "serif",
            "font-size-12": "calc(@font-base-unit * 3)",
            "font-size-16": "calc(@font-base-unit * 4)",
            "font-size-20": "calc(@font-base-unit * 5)",
            "font-size-24": "calc(@font-base-unit * 6)",
            "font-size-40": "calc(@font-base-unit * 10)",
            "font-size-48": "calc(@font-base-unit * 12)",
            "font-size-64": "calc(@font-base-unit * 16)",
            "line-height-base-unit": "1",
            "line-height-small": "calc(@line-height-base-unit * 1.1)",
            "line-height-medium": "calc(@line-height-base-unit * 1.3)",
            "line-height-large": "calc(@line-height-base-unit * 1.5)",
            "font-weight-lighter": "100",
            "font-weight-light": "200",
            "font-weight-normal": "400",
            "font-weight-bold": "700",
            "font-weight-bolder": "900"
        }
    }
]
    `
}
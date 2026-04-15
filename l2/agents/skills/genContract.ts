/// <mls fileReference="_102027_/l2/agents/skills/genContract.ts" enhancement="_blank"/>

export const skill = `
# SKILL: Contract

You are responsible for creating the contract file — the single source of
truth for all TypeScript types used by the feature.

You generate enums, type aliases, constants, and interfaces.
You contain no logic whatsoever. Types and values only.

---

## Triple Slash (Mandatory)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l1/path/file.ts" enhancement="_blank" />
\`\`\`

Built from project + outputPath:
Given { "project": 102027, "outputPath": "/l1/petshop/contract.ts" }:

\`\`\`ts
/// <mls fileReference="_102027_/l1/petshop/contract.ts" enhancement="_blank" />
\`\`\`

---

## Generation order (always follow this sequence)

Generate the sections in this exact order so that later declarations
can safely reference earlier ones:

  1. enums
  2. types
  3. constants
  4. interfaces

Within each section, preserve the order the entries appear in the JSON.

---

## 1. Enums — for each entry in \`enums\`

Generate an exported enum. Each entry has a values array of
{ key, value } pairs. Use the key as the enum member name and
the value as its string literal.

\`\`\`ts
// JSON
"enums": {
  "PetshopAction": {
    "values": [
      { "key": "SAVE",   "value": "save"   },
      { "key": "DELETE", "value": "delete" },
      { "key": "LOAD",   "value": "load"   }
    ]
  }
}

// Generated
export enum PetshopAction {
  SAVE   = 'save',
  DELETE = 'delete',
  LOAD   = 'load',
}
\`\`\`

---

## 2. Types — for each entry in \`types\`

Generate an exported type alias. The definition field is the
right-hand side of the type assignment, rendered verbatim.

\`\`\`ts
// JSON
"types": {
  "PetshopProductId": { "definition": "string" },
  "PetshopStatus":    { "definition": "PetshopAction.SAVE | PetshopAction.LOAD" }
}

// Generated
export type PetshopProductId = string;
export type PetshopStatus    = PetshopAction.SAVE | PetshopAction.LOAD;
\`\`\`

---

## 3. Constants — for each entry in \`constants\`

Generate an exported const with explicit type annotation.
The value field is rendered as-is — wrap strings in quotes,
numbers and booleans as literals.

\`\`\`ts
// JSON
"constants": {
  "PETSHOP_API_VERSION": { "type": "string",  "value": "v1"   },
  "PETSHOP_MAX_STOCK":   { "type": "number",  "value": 9999   },
  "PETSHOP_ACTIVE":      { "type": "boolean", "value": true   }
}

// Generated
export const PETSHOP_API_VERSION: string  = 'v1';
export const PETSHOP_MAX_STOCK:   number  = 9999;
export const PETSHOP_ACTIVE:      boolean = true;
\`\`\`

---

## 4. Interfaces — for each entry in \`interfaces\`

Generate an exported interface. Each field has name, type, and
optionally optional: true which adds the ? modifier.

When the JSON entry has extends, add it to the interface declaration.

\`\`\`ts
// JSON
"interfaces": {
  "PetshopBaseProduct": {
    "fields": [
      { "name": "id",    "type": "string" },
      { "name": "shopId","type": "string" }
    ]
  },
  "PetshopCatalogProduct": {
    "extends": "PetshopBaseProduct",
    "fields": [
      { "name": "name",        "type": "string"  },
      { "name": "price",       "type": "number"  },
      { "name": "imageUrl",    "type": "string",  "optional": true },
      { "name": "active",      "type": "boolean" },
      { "name": "tags",        "type": "string[]" },
      { "name": "categoryId",  "type": "string"  }
    ]
  }
}

// Generated
export interface PetshopBaseProduct {
  id:     string;
  shopId: string;
}

export interface PetshopCatalogProduct extends PetshopBaseProduct {
  name:       string;
  price:      number;
  imageUrl?:  string;
  active:     boolean;
  tags:       string[];
  categoryId: string;
}
\`\`\`

Field type rules:
- Primitives (string, number, boolean) → rendered as-is
- Arrays (string[], number[], InterfaceName[]) → rendered as-is
- References to other interfaces or enums → rendered as-is
- optional: true → append ? to the field name, no | undefined

Alignment: align the : of all fields in the same interface to the
column of the longest field name + 1 space. This keeps the file readable.

---

## Full output example

\`\`\`ts
/// <mls fileReference="_102027_/l1/petshop/contract.ts" enhancement="_blank" />

export interface PetshopBaseProduct {
  id:     string;
  shopId: string;
}

...

\`\`\`

---

## What you NEVER do

- Add any imports
- Add any logic, functions, or classes
- Use | undefined instead of ? for optional fields
- Generate a section that is absent from the JSON
  (no enums key → no enum block; no types key → no type block; etc.)
- Repeat declarations with the same name
- Change the generation order (enums → types → constants → interfaces)
`;
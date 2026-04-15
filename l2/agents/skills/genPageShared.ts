/// <mls fileReference="_102027_/l2/agents/skills/genPageShared.ts" enhancement="_blank"/>

export const skill = `
# SKILL: Shared Component

You are responsible for creating the Shared file — a base Lit component
extended by the WebComponent. You are the orchestration layer: you control
all reactive states, properties, and backend communication.

You never render UI. You never register a custom element.

---

## Your responsibility

From a definition JSON you generate a TypeScript file with a base Lit class that:

- Declares all @property() and @state() — one state per field, never an interface as a state
- Watches state changes via updated() and dispatches to private action methods
- Aggregates individual states back into interface objects when calling execBff
- Distributes bff results across individual states on success
- Imports all interfaces from the external file informed in the JSON
- Never implements render() or registers a custom element

---

## Triple Slash (Mandatory)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l2/path/file.ts" enhancement="_102027_/l2/enhancementLit" />
\`\`\`

Built from project + outputPath:
Given { "project": 102027, "outputPath": "/l2/petshop/product/shared.ts" }:

\`\`\`ts
/// <mls fileReference="_102027_/l2/petshop/product/shared.ts" enhancement="_102027_/l2/enhancementLit" />
\`\`\`

---

## Imports

Collect every non-primitive type used across properties, states, and
actions[*].bff.params / result — import them all at once from interfacesPath.
Never declare interfaces in this file.

\`\`\`ts
import { CollabLitElement }      from '/_100554_/l2/collabLitElement.js';
import { property, state }       from 'lit/decorators.js';
import type { BffClientOptions } from '/_102029_/l2/bffClient.js'; // mandatory
import { execBff }               from '/_102029_/l2/bffClient.js'; // mandatory
import type { PetshopAction, PetshopCatalogProduct, ... } from '<interfacesPath>';
\`\`\`

## Imports do contract — separar valores de tipos

Collect all names used from the contract and split them into two groups
before emitting the import statements:

Value imports (import without "type"):
  - Everything that comes from enums in the contract JSON
  - Everything that comes from constants in the contract JSON
  These exist as JavaScript values at runtime and MUST NOT use import type.

Type imports (import type):
  - Everything that comes from interfaces in the contract JSON
  - Everything that comes from types in the contract JSON
  These are erased at compile time and are safe to use import type.

Emit one import line per group, only if the group is non-empty.
Both lines point to the same interfacesPath.

\`\`\`ts
import      { PetshopAction }                       from '<interfacesPath>';
import type { PetshopProduct, PetshopGetProductParams } from '<interfacesPath>';
\`\`\`

NEVER mix enums or constants into an import type statement.
NEVER mix interfaces or types into a plain import statement.

---

## Properties — @property()

For each item in properties. Map primitive type to decorator option:
string → String, number → Number, boolean → Boolean. Non-primitives omit type.
Use reflect: true only when the JSON field reflect === true.

\`\`\`ts
@property({ type: String })
productId: string = '';
\`\`\`

---

## States — @state() — one per field, never an interface type

CRITICAL RULE: A state must NEVER have an interface as its type.
Interfaces are composite — they cannot be reactive as a unit.
Every field of every interface that the component needs must be
declared as its own individual @state().

Each state in the JSON has:
- name: the state field name (e.g. "product_name")
- type: the TypeScript primitive type (e.g. "string", "number", "boolean")
- default: the initial value
- reset: (optional) true = this state is reset to null inside its action method
- interfaceGroup: (optional) which interface this field belongs to
- field: (optional) the original field name inside that interface

States WITHOUT interfaceGroup are control states (action, loading, error, etc).
States WITH interfaceGroup are data fields that map to an interface.

Group states in the output by interfaceGroup, with a comment header for each group:

\`\`\`ts
// states — controle
@state() action:  PetshopAction | null = null;
@state() loading: boolean = false;

// states — PetshopCatalogProduct
@state() product_id:          string  = '';
@state() product_name:        string  = '';
@state() product_description: string  = '';
@state() product_price:       number  = 0;
@state() product_stock:       number  = 0;
@state() product_categoryId:  string  = '';
@state() product_imageUrl:    string  = '';
@state() product_active:      boolean = true;
\`\`\`

---

## Lifecycle — connectedCallback

Generate only when lifecycle.connectedCallback is present. Always call
super.connectedCallback() first. If dispatchAction is set, assign it to
the action state.

\`\`\`ts
connectedCallback() {
  super.connectedCallback();
  this.action = PetshopAction.LOAD;
}
\`\`\`

---

## updated() — reacting to state changes

Generate a single updated(changed: Map<string, unknown>).
For each unique trigger.state across all actions, emit one
if (changed.has('stateName')) block containing one if per action.

When trigger.value contains a dot → enum reference, render as-is.
When trigger.value is a plain string → wrap in quotes.

\`\`\`ts
updated(changed: Map<string, unknown>) {
  if (changed.has('action')) {
    if (this.action === PetshopAction.LOAD) this._load();
    if (this.action === PetshopAction.SAVE) this._save();
  }
}
\`\`\`

Only generate updated() when at least one action is defined.

---

## Action methods — private async, one per action

Each action generates one private async method. Follow this exact order:

Step 1 — Reset trigger state (when state.reset === true)
Set this.<triggerState> = null as the FIRST line, before any other code.
This prevents the updated() watcher from re-triggering the same action.

Step 2 — onStart assignments (before try/catch)
For each entry in bff.onStart, assign the state immediately after the reset.
Use this for flags like loading = true.

Step 3 — Build the params object (aggregation from states)

CRITICAL RULE: Never pass a state directly as params if it holds an interface type.
The params object must always be built by aggregating individual states.

To build the params object for a given bff.params interface:
- Look at all states that have interfaceGroup matching that interface name
- Use each state's field value as the object key
- Use this.stateName as the object value
- Also include any @property() fields whose name matches a field
  in the params interface (e.g. productId)
- Cast the result with as ParamsInterface

Example — building PetshopUpdateProductParams from states + properties:
\`\`\`ts
{
  productId:   this.productId,       // from @property()
  name:        this.product_name,    // from state, field: "name"
  description: this.product_description,
  price:       this.product_price,
  stock:       this.product_stock,
  categoryId:  this.product_categoryId,
  imageUrl:    this.product_imageUrl,
  active:      this.product_active,
} as PetshopUpdateProductParams
\`\`\`

Example — building PetshopGetProductParams (only needs productId):
\`\`\`ts
{ productId: this.productId } as PetshopGetProductParams
\`\`\`

To know which fields a params interface needs, cross-reference the
states array: fields with interfaceGroup === bff.params define the
data fields; properties whose name appears as a field in the interface
cover the identity fields (ids, slugs, etc).

Step 4 — onSuccess assignments (inside try, after await)

For each entry in bff.onSuccess:
- value === "result.fieldName" → this.stateName = result.fieldName
- value === "true"/"false"    → boolean literal
- value contains a dot and is not "result.*" → enum reference, as-is

Step 5 — onError assignments (inside catch)
Same rules as onSuccess. Always generate catch even if onError is empty.

Full example — _load():
\`\`\`ts
private async _load() {
  this.action  = null;           // Step 1: reset (reset: true)
  this.loading = true;           // Step 2: onStart
  try {
    const result = await execBff<PetshopCatalogProduct>(  // Step 3: params
      'petshop.getProduct',
      { productId: this.productId } as PetshopGetProductParams,
    );
    this.product_id          = result.id;           // Step 4: onSuccess
    this.product_name        = result.name;
    this.product_description = result.description;
    this.product_price       = result.price;
    this.product_stock       = result.stock;
    this.product_categoryId  = result.categoryId;
    this.product_imageUrl    = result.imageUrl;
    this.product_active      = result.active;
    this.loading = false;
  } catch (e) {
    this.loading = false;                           // Step 5: onError
  }
}
\`\`\`

Full example — _save() with aggregated params:
\`\`\`ts
private async _save() {
  this.action  = null;           // Step 1: reset
  this.loading = true;           // Step 2: onStart
  try {
    await execBff<PetshopCatalogProduct>(
      'petshop.updateProduct',
      {                          // Step 3: aggregated from states + properties
        productId:   this.productId,
        name:        this.product_name,
        description: this.product_description,
        price:       this.product_price,
        stock:       this.product_stock,
        categoryId:  this.product_categoryId,
        imageUrl:    this.product_imageUrl,
        active:      this.product_active,
      } as PetshopUpdateProductParams,
    );
    this.loading = false;        // Step 4: onSuccess
  } catch (e) {
    this.loading = false;        // Step 5: onError
  }
}
\`\`\`

---

## useMock — mock mode for action methods

Each action in the JSON may have an optional useMock boolean field.

useMock: false (or absent) → generate the method normally with execBff.

useMock: true → generate the method with the execBff call commented out
and a mock object in its place. The mock object must be built from the
states that have interfaceGroup matching bff.result, using realistic
placeholder values per type:
  - string  → short descriptive string related to the field name
  - number  → a realistic non-zero number (price → 89.90, stock → 10)
  - boolean → true
  - string (imageUrl / image / url) → 'https://placehold.co/400x400?text=Mock'
  - string (id / ...Id) → 'mock-001'

When bff.result ends with [] (array) → mock is an array with 2-3 items.
Each item follows the same placeholder rules above, with incremental ids
(mock-001, mock-002, mock-003) and varied names.

Structure when useMock: true

The commented execBff block comes FIRST, then the mock object.
The comment must say exactly: // Remove comment to execute

\`\`\`ts
private async _load() {
  this.action  = null;    // Step 1: reset
  this.loading = true;    // Step 2: onStart

  try {
    /*
    // Remove comment to execute
    const result = await execBff<PetshopProduct>(
      'petshop.getProduct',
      { productId: this.productId } as PetshopGetProductParams,
    );
    */

    const result: PetshopProduct = {   // mock object
      id:         'mock-001',
      name:       'Ração Golden Premium',
      price:      89.90,
      categoryId: 'cat-001',
      imageUrl:   'https://placehold.co/400x400?text=Mock',
      active:     true,
    };

    // Step 4: onSuccess — identical to non-mock
    this.product_id         = result.id;
    this.product_name       = result.name;
    this.product_price      = result.price;
    this.product_categoryId = result.categoryId;
    this.product_imageUrl   = result.imageUrl;
    this.product_active     = result.active;
    this.loading = false;
  } catch (e) {
    this.loading = false;   // Step 5: onError
  }
}
\`\`\`

Array result example — when bff.result === "PetshopCategory[]":
\`\`\`ts
    /*
    // Remove comment to execute
    const result = await execBff<PetshopCategory[]>(
      'petshop.listCategories',
      {} as PetshopListCategoriesParams,
    );
    */

    const result: PetshopCategory[] = [
      { id: 'mock-001', name: 'Rações' },
      { id: 'mock-002', name: 'Brinquedos' },
      { id: 'mock-003', name: 'Acessórios' },
    ];

    this.categories = result;
\`\`\`

Rules

- The onSuccess and onError assignments are IDENTICAL whether useMock is
  true or false — only the data source changes (execBff vs mock object).
- The mock type annotation uses the same type as bff.result:
  const result: PetshopProduct = {...}
- The commented block must be a valid, complete execBff call — so the
  developer can uncomment it and it works immediately without edits.
- When useMock is absent, treat it as false — generate normally.

## What you NEVER do

- Implement render()
- Register the component as a custom element
- Declare interfaces — they always come from interfacesPath
- Use an interface type as a @state() type — always expand to individual fields
- Pass a composite state as params — always aggregate from individual states
- Put the reset line anywhere other than the first line of the method
- Generate updated() if no actions are defined
- Generate connectedCallback() if lifecycle is absent from the JSON
- Add any logic not described in the JSON
`;
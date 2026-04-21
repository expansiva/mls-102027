/// <mls fileReference="_102027_/l2/agents/skills/genPageShared.ts" enhancement="_blank"/>

export const skill = `
---
# Lit Base Component — Shared File Generator

You generate a **Shared** TypeScript file: a headless Lit 3 base class that holds all reactive state and communicates with the backend via \`execBff\`. It never renders, never registers a custom element, **never declares any enum**, and **never dispatches events** — all enums are imported from the contract, and all public methods (navigation, emits) are plain functions that the extending WebComponent calls directly.

---

## Inputs you need

| Input | What it is |
|---|---|
| **pages JSON** | Source of truth for page structure, organisms, states, emits, navigation |
| **contract .ts file** | Already-generated file with interfaces, enums and mocks. **Import everything from here — do NOT redeclare anything.** |

---

## CRITICAL — \`action\` state type

Scan the contract for every exported enum whose name ends in \`Action\` (e.g. \`TempStateAction\`, \`NavigationFieldsAction\`, \`EmitsAction\`). The \`action\` state is a **union of all of them**:

\`\`\`ts
@state() action: TempStateAction | NavigationFieldsAction | EmitsAction | null = null;
\`\`\`

- If the contract has 2 \`*Action\` enums → union has 2 members. If 4 → union has 4.
- **Never use only one \`*Action\` enum as the type**
- **Never declare a new enum in this file**

---

## CRITICAL — \`updated()\` covers every enum value

\`updated()\` must have one \`if\` branch for **every value across every \`*Action\` enum** in the union — not just \`EmitsAction\`, all of them.

\`\`\`ts
updated(changed: Map<string, unknown>) {
  if (changed.has('action')) {
    // EmitsAction
    if (this.action === EmitsAction.SUBMIT_LOGIN)           this._submitLogin();

    // NavigationFieldsAction
    if (this.action === NavigationFieldsAction.TO_FORGOT_PASSWORD) this.navigateToForgotPassword();
    if (this.action === NavigationFieldsAction.TO_REGISTER)        this.navigateToRegister();

    // TempStateAction
    if (this.action === TempStateAction.SHOW_PASSWORD)      this._toggleShowPassword();
    if (this.action === TempStateAction.REMEMBER_ME)        this._toggleRememberMe();
    if (this.action === TempStateAction.ERROR_MESSAGE)      this._clearErrorMessage();
  }
}
\`\`\`

Rules for \`updated()\`:
- One \`if\` per enum value — no \`else if\`, no \`switch\`
- Group by enum with a comment header
- Only generate \`updated()\` if at least one action exists
- Only generate \`connectedCallback()\` if something dispatches on mount

---

## CRITICAL — No \`dispatchEvent\` anywhere

The Shared file **never** calls \`dispatchEvent\`. Navigation and emit methods are plain \`public\` functions. The WebComponent that extends this class is responsible for wiring them to DOM events if needed.

\`\`\`ts
// ✅ correct — plain method, no dispatch
public navigateToForgotPassword() {
  // e.g. update a router state, call a service, change a @state()
}

public emitSubmitLogin() {
  // prepare payload, call a service, or just update state
  // NO dispatchEvent here
}

// ❌ wrong
public navigateToForgotPassword() {
  this.dispatchEvent(new CustomEvent(...));  // NEVER
}
\`\`\`

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

## Reasoning process — follow this order

### Step 0 - Name class export
pageName atributte + "Shared" === ex: export class LoginShared

### Step 1 — Understand the page
Read \`pages[*].purpose\` and each \`organism[*].purpose\`.

### Step 2 — Identify \`@property()\` fields
Only values that come from outside: \`dataShape.params\` with \`source.from === "route"\` or \`"input"\`.

### Step 3 — Identify \`@state()\` fields

**Control states** — always present:
\`\`\`ts
@state() action:  TempStateAction | NavigationFieldsAction | EmitsAction | null = null;
@state() loading: boolean = false;
@state() error:   string | null = null;
\`\`\`

**Data states** — one primitive per \`entityField\` in \`dataShape.entityFields\`:
- Name = \`entity_entityField\` (e.g. \`entity: "user"\`, \`entityField: "email"\` → \`user_email\`)
- NEVER use an interface as \`@state()\` type — always expand to primitives

**Computed states** — one per \`computedField.fieldId\`:
- Type: \`boolean\` if name starts with \`is\`, \`has\`, \`can\`, \`should\`; otherwise \`string\`

**Temp states** — from \`pages[*].tempStates\` and \`organism[*].tempStates\`:
- Name = last segment of \`stateKey\`, camelCase
- Initial value from \`initialValue\`

**Action states** — from \`pages[*].actionStates\`:
- Import enum from contract (e.g. \`Loading\`)
- Name = last segment of \`stateKey\`, camelCase
- Initial value = first value in \`values[]\` using the enum

### Step 4 — Map every enum value to a handler method

For each \`*Action\` enum in the contract, map every value to a private or public method:

| Enum | Value | Handler |
|---|---|---|
| \`EmitsAction\` | each event | \`private async _methodName()\` — calls bff |
| \`NavigationFieldsAction\` | each target | \`public navigateTo*()\` — updates state or calls router |
| \`TempStateAction\` | each toggle/flag | \`private _toggleName()\` or \`private _clearName()\` — flips a \`@state()\` |

### Step 5 — Design bff action methods (\`EmitsAction\` values)

For each \`emits\` entry → one \`private async\` method:
1. \`this.action = null\` — ALWAYS the first line
2. \`this.loading = true\` + \`this.error = null\`
3. bff call wrapped in commented block
4. Mock line using contract mocks
5. Distribute result into \`@state()\` fields
6. Call computed methods
7. Update action state enum (e.g. \`this.loginLoading = Loading.SUCCESS\`)
8. \`this.loading = false\`

### Step 6 — Design temp state toggle methods (\`TempStateAction\` values)

Simple synchronous methods that flip or clear a \`@state()\`:

\`\`\`ts
private _toggleShowPassword() {
  this.action       = null;
  this.showPassword = !this.showPassword;
}

private _toggleRememberMe() {
  this.action     = null;
  this.rememberMe = !this.rememberMe;
}

private _clearErrorMessage() {
  this.action       = null;
  this.errorMessage = '';
}
\`\`\`

Always start with \`this.action = null\`.

### Step 7 — Design navigation methods (\`NavigationFieldsAction\` values)

Public methods. No \`dispatchEvent\`. Update state or call a router directly:

\`\`\`ts
public navigateToForgotPassword() {
  this.action = null;
  // router call or state change here
}

public navigateToRegister() {
  this.action = null;
}
\`\`\`

Always start with \`this.action = null\`.

### Step 8 — Design emit methods (\`EmitsAction\` values — public surface)

These are separate public methods that expose the payload. No \`dispatchEvent\`:

\`\`\`ts
public emitSubmitLogin() {
  // payload available as state; extending component reads it
  this.action = null;
}
\`\`\`

### Step 9 — Computed field methods

One \`private\` method per \`computedField\`. Called inside bff action methods after field distribution:

\`\`\`ts
private _computeIsFormValid() {
  this.isFormValid =
    this.user_email.includes('@') &&
    this.user_password.length >= 8;
}
\`\`\`

---


## Imports

\`\`\`ts
import { CollabLitElement } from '/_100554_/l2/collabLitElement.js';
import { property, state }  from 'lit/decorators.js';
import { execBff }          from '/_102029_/l2/bffClient.js';
\`\`\`

From the contract (\`import type\` for interfaces, regular \`import\` for enums and mocks):
\`\`\`ts
import type { user } from '{interfacePath}';
import {
  TempStateAction,
  NavigationFieldsAction,
  EmitsAction,
  Loading,
  Mock_user,
} from '{interfacePath}';
\`\`\`

Derive \`{interfacePath}\` from the contract's \`fileReference\`, replacing \`.ts\` with \`.js\`.

---

## execBff pattern — CRITICAL

\`execBff\` never throws on server errors. Always resolves with \`{ data, error, ok }\`.

\`\`\`ts
private async _submitLogin() {
  this.action  = null;         // ← ALWAYS first
  this.loading = true;
  this.error   = null;

  try {
    /*
    // Remove comment to execute
    const result = await execBff<user>(
      'user.submitLogin',
      { email: this.user_email, password: this.user_password },
    );
    if (result.error) {
      this.error        = result.error.message;
      this.errorMessage = result.error.message;
      this.loginLoading = Loading.ERROR;
      this.loading      = false;
      return;
    }
    const res = result.data;
    if (!res) {
      this.loading = false;
      return;
    }
    */

    const res: user = Mock_user[0];

    this.user_email    = res.email;
    this.user_password = res.password;
    this._computeIsFormValid();
    this.loginLoading = Loading.SUCCESS;
    this.loading      = false;

  } catch (e) {
    this.loading      = false;
    this.loginLoading = Loading.ERROR;
    this.error        = (e as Error).message;
  }
}
\`\`\`

Array result: \`const res: user[] = Mock_user;\` (no \`[0]\`), assign directly to a list \`@state()\`.

**Order inside try — never deviate:**
1. \`this.action = null\`
2. \`this.loading = true\` + \`this.error = null\`
3. Commented \`execBff\` block with full error/guard chain inside
4. Mock line
5. Distribute fields
6. Call computed methods
7. Update action state enum to SUCCESS
8. \`this.loading = false\`
9. \`catch\` → loading = false, action state = ERROR, error message

---

## State naming conventions

| Source | State name |
|---|---|
| \`entity: "user"\`, \`entityField: "email"\` | \`user_email\` |
| \`stateKey: "ui.login.showPassword"\` | \`showPassword\` |
| \`stateKey: "ui.login.rememberMe"\` | \`rememberMe\` |
| \`stateKey: "ui.login.errorMessage"\` | \`errorMessage\` |
| \`stateKey: "ui.login.loading"\` (actionState) | \`loginLoading\` (\`Loading\` enum) |
| \`computedField.fieldId: "isFormValid"\` | \`isFormValid: boolean\` |

---

## What you NEVER do

- Implement \`render()\`
- Register a custom element (\`customElements.define\`)
- Declare any enum — all enums come from the contract
- Use only one \`*Action\` enum as the \`action\` type — always build the full union
- Leave any \`*Action\` enum value without a branch in \`updated()\`
- Call \`dispatchEvent\` anywhere — not in navigation, not in emits, nowhere
- Use an interface type directly as \`@state()\` — always expand to primitives
- Put \`this.action = null\` anywhere other than the first line of each handler method
- Generate \`updated()\` when there are no actions
- Generate \`connectedCallback()\` when nothing dispatches on mount

---
`
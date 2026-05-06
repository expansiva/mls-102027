/// <mls fileReference="_102027_/l2/agents/skills/genPageRender.ts" enhancement="_blank"/>
 
export const skill = `
# SKILL: Lit WebComponent Render Generator

You generate the **WebComponent** TypeScript file — the pure visual layer of a Lit feature.
You extend the Shared class and are responsible **only** for:

1. Generating the \`render()\` method from the JSON layout definition
2. Reading inherited states (from the Shared class) to populate the DOM
3. Wiring DOM events to set inherited states directly

You **never** declare new methods, dispatch CustomEvents, call the backend, or redeclare \`@state\` / \`@property\`. All logic lives in the Shared.

---

## Step 0 — Read the Shared class first

Before writing a single line, scan the provided Shared class to extract:

| What to extract | Why |
|---|---|
| All \`@state()\` field names and types | Use exact names in the template |
| All enum imports and their values | Use exact enum references in events |
| Method names (\`navigateTo*\`, public methods) | Reference in \`type: "method"\` events |
| The \`Loading\` enum values (IDLE, SUCCESS, ERROR) | Match condition values in JSON |

**Rule**: If a state, enum value, or method referenced in the JSON does not exist in the Shared class, flag it as a discrepancy and use the closest matching name found in the Shared. Never invent names.

---

## Step 1 — Triple Slash (Mandatory — first line)

Every file MUST start with the triple slash directive as its first line.

\`\`\`ts
/// <mls fileReference="_XXXXX_/l1/path/contract.ts" enhancement="_102020_/l2/enhancementAura" />
\`\`\`

Built from \`project\` + \`outputPath\`:

Given \`{ "project": 102027, "outputPath": "/l2/storeLocation/component.ts" }\`:

\`\`\`ts
/// <mls fileReference="_102027_/l2/storeLocation/component.ts" enhancement="_102020_/l2/enhancementAura" />
\`\`\`

---

## Step 2 — Tag naming rule

Derive the \`@customElement\` tag from the JSON \`tagName\` field directly:

\`\`\`json
"tagName": "pizzaria--web--desktop--login-102009"
\`\`\`
→ \`@customElement('pizzaria--web--desktop--login-102009')\`

---

## Step 3 — Imports

Always include:
\`\`\`ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
\`\`\`

Then add each entry from the JSON \`imports\` array in order. Path formatting rules:
- Prepend \`/\` if missing
- Replace \`.ts\` with \`.js\`, or append \`.js\` if no extension present
- \`"type"\` → \`import type { ... }\`, \`"value"\` → \`import { ... }\`

**Never** import \`@property\` or \`@state\` decorators — they live in the Shared.

### \`anyInterfaces\` placeholder rule

When an import entry uses \`anyInterfaces\` as its import clause, it is a **placeholder** — not a literal name. You must:

1. Scan the entire \`render()\` you are about to generate
2. Identify every enum value, type, and interface actually referenced (e.g. \`EmitsAction\`, \`Loading\`, \`NavigationFieldsAction\`)
3. Replace \`{ anyInterfaces }\` with the exact set of names needed — nothing more, nothing less

\`\`\`ts
// JSON says:  { "import": "{ anyInterfaces }", "path": "_102009_/.../login.js" }
// render() uses: EmitsAction.SUBMIT_LOGIN and Loading.LOADING / Loading.ERROR
// → generate:
import { EmitsAction, Loading } from '/_102009_/.../login.js';
\`\`\`

Import order in the final file:
1. \`import { html } from 'lit'\`
2. \`import { customElement } from 'lit/decorators.js'\`
3. Entries from \`imports\` array — exactly as declared, in order

---

## Step 4 — I18n block

When \`i18n\` is present in the JSON, generate the i18n block **between imports and \`@customElement\`**, using the mandatory markers:

\`\`\`ts
/// **collab_i18n_start**
const message_en: Record<string, string> = {
  loading: 'Loading...',
  retry: 'Retry',
  // one entry per key in i18n.keys
};
const message_pt: Record<string, string> = {
  loading: 'Carregando...',
  retry: 'Tentar novamente',
};
type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = { en: message_en, pt: message_pt };
/// **collab_i18n_end**
\`\`\`

> Generate one entry per key listed in \`i18n.keys\`. Generate all languages listed in \`i18n.languages\`. Use sensible translations — \`en\` for English, \`pt\` for Brazilian Portuguese.

Inside the class, declare \`private msg = messages['en'];\` and resolve at top of \`render()\`:
\`\`\`ts
render() {
  const lang = document.documentElement.lang || 'en';
  this.msg = messages[lang] || messages['en'];
  ...
}
\`\`\`

---

## Step 5 — Class declaration

Extend the Shared. Register the custom element. Never redeclare \`@state()\` or \`@property()\`.

\`\`\`ts
@customElement('pizzaria--web--desktop--login-102009')
export class LoginPage extends LoginShared {
  private msg = messages['en'];

  render() { ... }
}
\`\`\`

The class name is derived from the JSON \`className\` field.
The \`extends\` target comes from the JSON \`extends\` field.

---

## Step 6 — render() body

**The only method you generate.** Returns \`html\\\`\\\`.

### 6a — Resolve i18n at the top
\`\`\`ts
render() {
  const lang = document.documentElement.lang || 'en';
  this.msg = messages[lang] || messages['en'];
\`\`\`

### 6b — Conditional early returns (from \`render.conditions\`)

Evaluate conditions in the order they appear in the JSON. Each condition maps to a named block in \`render.blocks\`. Cross-reference the Shared to confirm which state variable the condition string refers to.

\`\`\`ts
// condition: "this.ui_login_loading === 'loading'"
// But Shared has: @state() loginLoading: Loading = Loading.IDLE
// → translate: if (this.loginLoading === Loading.LOADING) ...

if (this.loginLoading === Loading.LOADING) return html\`<div class="login-page__loading">
  <span class="spinner"></span>
  <span class="loading__message">\${this.msg.loading}</span>
</div>\`;

if (this.loginLoading === Loading.ERROR) return html\`<div class="login-page__error">
  <span class="error__message">\${this.errorMessage}</span>
  <button class="btn btn--secondary" type="button"
    @click=\${() => { this.action = LoginAction.RETRY_LOGIN; }}>
    \${this.msg.retry}
  </button>
</div>\`;
\`\`\`

**State name reconciliation rule**: The JSON may use prefixed names like \`ui_login_loading\` or \`ui_login_errorMessage\`. Always check the Shared class for the actual \`@state()\` field name (e.g., \`loginLoading\`, \`errorMessage\`) and use the Shared's name in the generated code.

### 6c — Default block

Return the default layout block as the final \`return html\\\`...\\\`\` statement.

---

## Event wiring rules

### \`type: "action"\` — sets the \`action\` state to trigger Shared's \`updated()\`

\`\`\`ts
// { "on": "submit", "type": "action", "state": "action", "value": "LoginAction.SUBMIT_LOGIN", "prevent": true }
@submit=\${(e: Event) => { e.preventDefault(); this.action = LoginAction.SUBMIT_LOGIN; }}

// { "on": "click", "type": "action", "state": "action", "value": "LoginAction.RETRY_LOGIN" }
@click=\${() => { this.action = LoginAction.RETRY_LOGIN; }}
\`\`\`

- When \`prevent === true\`, always call \`e.preventDefault()\` **first**
- The \`value\` field is always an enum reference — render it as-is (no quotes)

### \`type: "set"\` — assigns a value directly to a data state

\`\`\`ts
// cast: "string" → use (e.target as HTMLInputElement).value
@input=\${(e: Event) => { this.user_email = (e.target as HTMLInputElement).value; }}

// cast: "number"
@input=\${(e: Event) => { this.product_price = Number((e.target as HTMLInputElement).value); }}

// cast: "boolean" → always use .checked
@change=\${(e: Event) => { this.rememberMe = (e.target as HTMLInputElement).checked; }}

// cast: "toggle" → negate current boolean value
@click=\${() => { this.showPassword = !this.showPassword; }}
\`\`\`

### \`type: "method"\` — calls an inherited method from the Shared

\`\`\`ts
// { "on": "click", "type": "method", "method": "toForgotPassword" }
// Shared has: public navigateToForgotPassword()
@click=\${() => { this.navigateToForgotPassword(); }}
\`\`\`

Cross-reference the Shared to find the exact method name. The JSON \`method\` value may be a short alias; find the matching public method in the Shared.

---

## Binding rules

| Element / scenario | Binding |
|---|---|
| \`input[type=text/email/number/url]\` | \`.value=\${this.stateField}\` |
| \`input[type=checkbox]\` | \`?checked=\${this.stateField}\` |
| \`input[type=password]\` — dynamic type | \`\` type=\${this.showPassword ? 'text' : 'password'} \`\` |
| \`select\` | \`.value=\${this.stateField}\` |
| Any other element (span, div, etc.) | \`\${this.stateField}\` (interpolation) |
| \`disabled\` attribute | \`?disabled=\${this.stateField === Loading.LOADING}\` |
| \`condition\` on an element | wrap with \`\${condition ? html\\\`...\\\` : ''}\` |

---

## Label elements

When \`"element": "label"\` has both \`i18n\` and child \`input\`, render the i18n text as a text node **before** the input child:

\`\`\`ts
<label class="field">
  \${this.msg.email}
  <input type="email" class="field__input" .value=\${this.user_email}
    @input=\${(e: Event) => { this.user_email = (e.target as HTMLInputElement).value; }}
    autocomplete="username" />
</label>
\`\`\`

---

## Condition on elements

When a JSON element has a \`"condition"\` field, wrap it in a Lit conditional:

\`\`\`ts
// "condition": "this.isFormValid"
\${this.isFormValid ? html\`<button class="btn btn--primary login-form__submit" type="submit"
  ?disabled=\${this.loginLoading === Loading.LOADING}>
  \${this.msg.login}
</button>\` : ''}
\`\`\`

---

## Styling — Tailwind (always active)

Tailwind utility classes are **always** used. Never generate a \`static styles\` block or inline styles.

- If the JSON provides a \`"class"\` field for an element, use it as the base and complement it with additional Tailwind classes as needed to produce a coherent, visually consistent result
- If the JSON provides **no** \`"class"\` field, infer and apply appropriate Tailwind classes based on:
  - The element's **semantic role** (container, form, input, button, label, heading, error message, spinner, etc.)
  - The element's **position** in the layout hierarchy (wrapper vs. inner element)
  - The element's **state** (loading, error, disabled)
  - The overall **visual context** suggested by the component name and JSON structure

### Tailwind class guidelines by element type

| Element / role | Suggested Tailwind baseline |
|---|---|
| Page / root wrapper | \`flex flex-col min-h-screen\` |
| Form container | \`flex flex-col gap-4 w-full max-w-md mx-auto p-6\` |
| Card / panel | \`bg-white rounded-2xl shadow-md p-6\` |
| Section heading | \`text-2xl font-bold text-gray-800\` |
| Sub-heading / label | \`text-sm font-medium text-gray-700 mb-1\` |
| Text input | \`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500\` |
| Primary button | \`w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed\` |
| Secondary / ghost button | \`w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50\` |
| Link-style button | \`text-sm text-blue-600 hover:underline\` |
| Error message | \`text-sm text-red-600 mt-1\` |
| Loading spinner wrapper | \`flex flex-col items-center justify-center gap-3 py-12\` |
| Spinner element | \`h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent\` |
| Checkbox wrapper | \`flex items-center gap-2\` |
| Checkbox input | \`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500\` |
| Divider | \`my-4 border-t border-gray-200\` |
| Helper / hint text | \`text-xs text-gray-500 mt-1\` |

> These are starting points. Always adjust based on the actual element context and surrounding layout. The goal is a coherent, accessible UI — not a mechanical mapping.

---

## State name reconciliation — full algorithm

The JSON was authored against a planned contract that may differ slightly from the actual Shared class. Always reconcile:

1. Parse all \`@state()\` names from the Shared → build a lookup map
2. For each JSON reference to a state (bind, condition, event.state), find the closest match in the Shared map
3. For enum values in events, find the actual enum imported in the Shared
4. For method references, find the public method in the Shared

Common JSON → Shared mappings (illustrative, always verify against actual Shared):

| JSON reference | Typical Shared field |
|---|---|
| \`ui_login_loading\` | \`loginLoading\` (type: \`Loading\` enum) |
| \`ui_login_errorMessage\` | \`errorMessage\` |
| \`ui_login_showPassword\` | \`showPassword\` |
| \`ui_login_rememberMe\` | \`rememberMe\` |
| \`LoginAction.SUBMIT_LOGIN\` | \`EmitsAction.SUBMIT_LOGIN\` |
| \`LoginAction.RETRY_LOGIN\` | *(check Shared; may not exist — use closest action)* |
| \`toForgotPassword\` | \`navigateToForgotPassword()\` |
| \`toRegister\` | \`navigateToRegister()\` |

---

## What you NEVER do

- Declare \`@state()\` or \`@property()\` — inherited from Shared
- Declare any method beyond \`render()\`
- Dispatch \`CustomEvent\` — Shared's responsibility
- Call \`execBff\` or any backend method
- Generate \`static styles\` or inline styles
- Import \`@property\` or \`@state\` decorators
- Add i18n keys not declared in \`i18n.keys\`
- Mix enums into \`import type\` statements
- Invent state names, enum values, or method names not present in the Shared class

---
`;
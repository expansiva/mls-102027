/// <mls fileReference="_102027_/l2/agents/skills/genLess.ts" enhancement="_blank"/>

export const skill = `
# SKILL: Component LESS File

You are responsible for creating the component's LESS file.
From the JSON definition you generate a semantic, encapsulated LESS file
using only the system tokens provided in this skill.

You never invent tokens. You never place styles outside the root tag.
You never use tag selectors or element selectors — only the class names
declared in the JSON classes array.

---

- tagName     → root encapsulation tag and the component selector

---

## What you generate

### 1. Triple slash — always the first line

Every component file **must** start with the triple slash directive. It is indispensable for the system and must be the **first line** of the file.

\`\`\`less
/// <mls fileReference="_XXXXX_/l2/path/file.less" enhancement="_blank" />
\`\`\`

example 
{
  "project":102027,
  "outputPath": "/l2/petshop/layer/prod.ts",
}

\`\`\`less
/// <mls fileReference="_102027_/l2/petshop/layer/prod.less" enhancement="_blank" />
\`\`\`

---

### 2. Encapsulation within the component tag

All CSS must be inside the component tag defined in \`tagName\` in the JSON. Nothing outside it.

\`\`\`less
petshop-update-product {
    // all CSS goes here
}
\`\`\`

---

### 3. Tokens — use only the available ones

### 3.1 Main Rule

- **Use tokens** when the desired value exists in the provided token list.
- **Use the direct value** in the attribute when the value does not exist as a token.
- **Never invent tokens** that were not provided.

### 3.2 Available Tokens

\`\`\`less
[TOKENS]
\`\`\`

### 3.3 Correct Usage Examples

Token exists → use it:
\`\`\`less
font-family: @font-family-primary;
font-size: @font-size-16;
\`\`\`

Value has no token → use directly:
\`\`\`less
border-radius: 4px;
color: #e53935;
\`\`\`

---


## 4. Generating styles from the classes array

For each entry in classes, generate one LESS block using the
name as the class selector. Use role and context to decide
what CSS properties to apply.

Role → CSS pattern mapping:

state-container
  display: flex; align-items: center; justify-content: center;
  Use context to decide padding and any specific color.

loading-indicator
  Animated spinner — use border + border-radius + @keyframes animation.
  Never use a background image or external asset.

text
  font-size, font-family, color derived from context
  (loading message → muted; error message → danger color).

form-root
  display: flex; flex-direction: column; gap from tokens or direct value.

columns-container
  display: grid; grid-template-columns based on layout.columns value;
  gap from tokens or direct value.

column
  display: flex; flex-direction: column; gap from tokens or direct value.

full-width-row
  width: 100%; applies below the columns grid.

actions-row
  display: flex; justify-content: flex-end; gap from tokens or direct value.
  Context says "aligned to the right" → justify-content: flex-end.

field-wrapper
  display: flex; flex-direction: column; gap: 4px.
  label text styles: font-size, font-family.

text-input / select-input
  width: 100%; padding; border; border-radius; font-size; font-family; box-sizing: border-box.

checkbox-input
  width: auto; cursor: pointer.

button-base
  Shared button styles: padding, border-radius, cursor, font-size, font-family, border: none.
  Also include &:disabled { opacity: 0.6; cursor: not-allowed; }.

button-variant
  Only the variant-specific overrides (background-color, color, border).
  Context "primary" → filled background. Context "secondary" → transparent + border.

---

## Expected full structure

\`\`\`less
/// <mls fileReference="_102029_/petshop/updateProduct/PetshopUpdateProduct.less" enhancement="_blank" />

petshop-update-product {
    display: block;
    font-family: @font-family-primary;
    font-size: @font-size-16;

    .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 32px;
    }

    .error {
        color: #e53935;
        font-size: @font-size-14;
        padding: 8px 0;
    }

    form.update-product {
        display: flex;
        flex-direction: column;
        gap: 24px;

        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        label {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: @font-size-14;
            font-family: @font-family-primary;
        }

        input,
        textarea,
        select {
            width: 100%;
            font-size: @font-size-16;
            font-family: @font-family-primary;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px 12px;
            box-sizing: border-box;
        }

        textarea {
            resize: vertical;
        }

        input[type="checkbox"] {
            width: auto;
            cursor: pointer;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding-top: 8px;

            button {
                font-size: @font-size-16;
                font-family: @font-family-primary;
                padding: 10px 24px;
                border-radius: 4px;
                cursor: pointer;
                border: none;

                &.primary {
                    background-color: #1976d2;
                    color: #fff;

                    &:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                }

                &.secondary {
                    background-color: transparent;
                    color: #1976d2;
                    border: 1px solid #1976d2;
                }
            }
        }
    }
}
\`\`\`

---

## What you NEVER do

- Place any style outside the component tag
- Use element selectors (input, form, button, label) — only class selectors
- Invent tokens not in the provided list
- Generate styles for classes not listed in the JSON classes array
- Add resets or global styles
- Duplicate class declarations
`
/// <mls fileReference="_102027_/l2/agents/skills/jointendFields.ts" enhancement="_blank"/>

export const skill = `
# Jointed Fields — UI Layout Skill

**Style Name:** Jointed Fields
**Also known as:** Conjoined Fields · Fused Field Pair · Borderless Split Input

---

## What Is It?

Jointed Fields is a form layout pattern that pairs two semantically related input fields in the same row by removing the margin between them and sharing a unified container border. Each field keeps its own inline label (positioned small, at the top-left inside the field) and its own validation logic, but visually the pair reads as a single cohesive unit. The result: a form with 18 fields feels like 9.

---

## Core Principles

- **Pair by relationship** — only join fields with a natural sibling bond (e.g. First Name + Last Name, City + State, Check-in + Check-out).
- **Label inside the field** — each field uses a small, muted label anchored at the top-left, above the typed value.
- **No gap between joined fields** — the pair shares one outer border; only a thin internal vertical line separates them.
- **Proportional widths** — do not force 50/50. Size each field to match the expected input length (e.g. Postal Code narrow, Address wide).
- **Independent validation** — each field validates and shows errors on its own, without affecting the other.

---

## Anatomy

The group has a single rounded outer border. Inside, a vertical divider separates the two fields. Each cell contains a small label on top and the input value below. On focus, the outer border changes color to indicate the active state. On error, only the offending field changes background and label color; the error message appears below that specific cell.

---

## Common Field Pairings

| Left Field      | Right Field      | Suggested Split |
|-----------------|------------------|-----------------|
| First Name      | Last Name        | 50 / 50         |
| Phone           | Email            | 40 / 60         |
| Check-in Date   | Check-out Date   | 50 / 50         |
| Address         | Apartment/Suite  | 70 / 30         |
| City            | State            | 65 / 35         |
| Postal Code     | Country          | 30 / 70         |
| Card Number     | Cardholder Name  | 50 / 50         |
| Expiry Date     | CVV              | 60 / 40         |

---

## When to Use

Use when fields share a clear data relationship and you want to reduce perceived form density. Avoid when fields are unrelated, when one requires a complex picker that disrupts the layout, or when the form is single-column on mobile.

---

## Responsive Behavior

On narrow viewports (mobile), jointed fields should stack vertically, reverting to individual full-width fields — each with its own border and label — so usability is not compromised.

---

## Accessibility Notes

- Every input must have a programmatically associated label.
- The focus ring should be visible on the group container when any child field is active.
- Error messages must be linked to their input via aria-describedby.
- Tab order must follow left-to-right, top-to-bottom reading sequence.
- Never rely on color alone to communicate an error state.

---

## Summary

Jointed Fields leverages the Gestalt principle of proximity — elements with no gap between them are perceived as a single object. By removing margin between related fields and adding a shared border, users read two inputs as one unit, significantly reducing the cognitive weight of dense forms.
`;
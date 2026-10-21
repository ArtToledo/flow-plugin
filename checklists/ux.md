# UX checklist

Based on Nielsen's 10 heuristics and the behavior required by WCAG 2.2 AA. Cite items in `checklistRef` as `ux.md#<ID>` (e.g. `ux.md#UX-05`).

## UX-01 — Visible status

- Every new screen or component that shows data has loading, success, error and empty states.
- Slow actions give immediate feedback: a disabled button with an indicator, or progress.

## UX-02 — Error prevention and recovery

- Destructive actions ask for confirmation or allow undo.
- Validation is inline and well timed: on blur or on submit, not on every keystroke.
- Error messages say what happened and **how to fix it**, next to the field (3.3.1, 3.3.3).

## UX-03 — User control

- Back, cancel and undo are available, and modals close with Esc and with a button.
- No irreversible action without clear intent.

## UX-04 — Consistency

- New UI uses the component, copy and flow patterns already in the product.
- The same action has the same name everywhere.

## UX-05 — Keyboard and focus

- Everything works by keyboard (2.1.1), with no focus traps (2.1.2).
- Focus order is logical (2.4.3).
- Focus is visible (2.4.7) and not hidden by a sticky header or a toast (2.4.11).
- Focus moves correctly when a modal opens or closes, and after navigation.

## UX-06 — Targets and gestures

- Touch targets are at least 24×24 CSS px, or have equivalent spacing (2.5.8).
- Dragging always has a click or single-tap alternative (2.5.7).

## UX-07 — Forms

- Fields have real labels (an associated `<label>` or `aria-labelledby`), not just placeholders (3.3.2).
- The same process never asks again for information already given (3.3.7).
- Login has no cognitive test, and allows pasting and password managers (3.3.8).
- Personal data fields use the right `autocomplete` (1.3.5).

## UX-08 — Copy

- Text is clear and free of technical jargon for end users, in the product's language.
- Buttons use verbs that say what will happen ("Save order", not "OK").

# ADR-0012: Typed interface dictionaries and localised content fields

- Status: accepted
- Date: 2026-09-05

## Context

Every screen and every piece of content must exist in French and English, and switching language must not lose the selection or the progress.

## Decision

- Interface strings live in `messages.en.ts` (the key set) and `messages.fr.ts` typed as `Record<MessageKey, string>`, so a missing key fails type-checking; `t(key, params)` interpolates `{name}` placeholders and a unit test checks key parity.
- Content carries `{fr, en}` fields validated for parity at compile time; `L()` / `LL()` localise a field for the current language.
- The language is part of the profile and of the URL-independent state: switching language re-renders in place, keeps the URL and never changes evidence identifiers (idempotency keys exclude the locale).
- Numbers and dates use `Intl` (decimal comma accepted in inputs).

## Consequences

- No runtime dictionary loading; both languages ship in the bundle.
- Adding a third language means extending the `Locale` type, the content fields and one dictionary.

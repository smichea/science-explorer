# ADR-0008: Optional local PIN for guide mode

- Status: accepted
- Date: 2026-09-05

## Context

Guide pages show oral prompts, hidden hints, misconceptions and evidence. The learner and the guide share one device; the product has no accounts.

## Decision

- Guide mode is open by default. A guide may set a 4–8 digit PIN, stored as a salted SHA-256 hash in the profile settings on the device.
- An unlock lasts for the browser tab (sessionStorage); a new tab or a restart asks again. The PIN can be removed from the settings.
- This is a courtesy barrier against accidental opening, not a security boundary: anyone with the device can clear site data.

## Consequences

- No password recovery flow is needed; forgetting the PIN only requires resetting it from the settings of an unlocked tab or deleting the profile.

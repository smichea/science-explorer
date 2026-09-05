# ADR-0010: No cloud synchronisation; export/import is the transfer boundary

- Status: accepted
- Date: 2026-09-05

## Context

The product is local-first and collects no personal data beyond a first name and an age. Families may still change devices or keep a backup.

## Decision

- Progress is transferred through a versioned JSON envelope (`science-explorer-progress` v1) produced by the settings page: profile, settings, mission sessions, evidence events and journal entries.
- Import validates the envelope, refuses executable content and oversized files, shows a preview, then either creates a distinct restored explorer (identifiers re-keyed) or merges into the existing one; an entry is added to the journal.
- No network endpoint stores learner data; adding a sync service later must go through the same envelope.

## Consequences

- Privacy is a property of the architecture, not a policy.
- Two devices are not kept in sync automatically; a family exports before switching devices.

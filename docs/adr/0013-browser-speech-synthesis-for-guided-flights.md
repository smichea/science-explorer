# ADR-0013: Browser speech synthesis for the bird's-eye flight

- Status: accepted
- Date: 2026-09-05

## Context

The bird's-eye flight reads a short presentation of every remaining destination aloud while the camera flies over the atlas. The product is local-first, offline-capable and free of servers; the specification requires captions for any audio and lets reduced-motion users disable camera flights.

## Decision

- Narration uses the browser's Web Speech API (`speechSynthesis`) through one small store (`src/lib/state/speech.svelte.ts`): a voice matching the interface language is picked when available, text is spoken sentence by sentence (long utterances are cut by some engines), and a watchdog based on an estimated reading time resolves every utterance even when the engine never reports its end.
- Spoken text is derived from authored prose by `speakableText` (`src/lib/domain/speech.ts`): formulas become the word "formule"/"formula" and Markdown is stripped. Authors write a dedicated `overview` field in plain sentences; the compiler warns when it carries LaTeX or Markdown.
- The card always shows the text being read (caption); the voice can be muted (preference `tourVoice`) and, without a voice, the flight advances after the estimated reading time.
- No recorded audio and no cloud text-to-speech: nothing leaves the device, nothing must be downloaded, and the bundle does not grow with content.

## Consequences

- Voice quality depends on the device (system voices); some browsers offer none, in which case the text alone carries the flight.
- Numbers and abbreviations are written out in the overviews ("mille six cent quatre") so that every engine reads them the same way.

import type { EvidenceEvent, JournalEntry, MissionSession, SimulationSnapshot } from '$lib/persistence/db';
import { evidenceRepo, journalRepo, sessionRepo } from '$lib/persistence/repositories';
import { computeProgression, type ProgressionSnapshot } from '$lib/domain/progression';
import { destinationState, type DestinationContext, type DestinationState } from '$lib/domain/progression/destination';
import type { CompiledNode } from '$lib/content-schema';
import { content } from './content.svelte';
import { profile } from './profile.svelte';

class LearningState {
  learnerId = $state<string | null>(null);
  evidence = $state.raw<EvidenceEvent[]>([]);
  sessions = $state.raw<MissionSession[]>([]);
  journal = $state.raw<JournalEntry[]>([]);
  clock = $state(Date.now());
  loading = $state(false);

  /** Derived progression snapshot, recomputed from the evidence log whenever it changes. */
  snapshot: ProgressionSnapshot | null = $derived.by(() => {
    if (!this.learnerId || !content.graph || !content.pkg || !profile.active) return null;
    const horizon = profile.horizon(content.pkg.horizon);
    if (!horizon) return null;
    return computeProgression(this.evidence, content.graph, content.pkg.horizon, horizon, new Date(this.clock));
  });

  openMissionIds: string[] = $derived(this.sessions.filter((s) => s.status !== 'completed' && s.status !== 'abandoned').map((s) => s.missionId));

  async bind(learnerId: string | null): Promise<void> {
    if (learnerId === this.learnerId) return;
    this.learnerId = learnerId;
    this.evidence = [];
    this.sessions = [];
    this.journal = [];
    if (!learnerId) return;
    this.loading = true;
    const [evidence, sessions, journal] = await Promise.all([
      evidenceRepo.listByLearner(learnerId),
      sessionRepo.listByLearner(learnerId),
      journalRepo.listByLearner(learnerId),
    ]);
    if (this.learnerId !== learnerId) return;
    this.evidence = evidence;
    this.sessions = sessions;
    this.journal = journal;
    this.clock = Date.now();
    this.loading = false;
  }

  async append(events: EvidenceEvent[]): Promise<EvidenceEvent[]> {
    const stored = await evidenceRepo.appendMany(events);
    if (stored.length) this.evidence = [...this.evidence, ...stored];
    return stored;
  }

  async commitStep(session: MissionSession, events: EvidenceEvent[], snapshot?: SimulationSnapshot): Promise<void> {
    const stored = await sessionRepo.commitStep(session, events, snapshot);
    this.upsertSession(session);
    if (stored.length) this.evidence = [...this.evidence, ...stored];
  }

  upsertSession(session: MissionSession): void {
    const others = this.sessions.filter((s) => s.id !== session.id);
    this.sessions = [...others, session];
  }

  async saveSession(session: MissionSession): Promise<void> {
    await sessionRepo.put(session);
    this.upsertSession(session);
  }

  async addJournal(entry: JournalEntry): Promise<void> {
    await journalRepo.put(entry);
    this.journal = [entry, ...this.journal.filter((j) => j.id !== entry.id)];
  }

  async removeJournal(id: string): Promise<void> {
    await journalRepo.delete(id);
    this.journal = this.journal.filter((j) => j.id !== id);
  }

  sessionFor(missionId: string): MissionSession | undefined {
    return this.sessions
      .filter((s) => s.missionId === missionId && s.status !== 'completed' && s.status !== 'abandoned')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  destinationContext(): DestinationContext | null {
    if (!content.graph || !content.pkg || !profile.active) return null;
    const horizon = profile.horizon(content.pkg.horizon);
    if (!horizon) return null;
    return {
      graph: content.graph,
      config: content.pkg.horizon,
      horizon,
      snapshot: this.snapshot,
      savedForLater: profile.settings?.savedForLater ?? [],
      openMissionIds: this.openMissionIds,
    };
  }

  destination(node: CompiledNode): DestinationState | null {
    const ctx = this.destinationContext();
    return ctx ? destinationState(node, ctx) : null;
  }
}

export const learning = new LearningState();

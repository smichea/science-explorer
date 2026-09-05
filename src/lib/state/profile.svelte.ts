import type { HorizonConfig, Locale, Stage } from '$lib/content-schema';
import { effectiveHorizon, type Horizon } from '$lib/domain/horizon';
import {
  buildProfile,
  confirmAge,
  needsAgeConfirmation,
  toSummary,
  withAge,
} from '$lib/domain/profile';
import type { LearnerProfile, ProfileSettings } from '$lib/persistence/db';
import {
  readActiveProfileId,
  readProfileIndex,
  removeProfileSummary,
  upsertProfileSummary,
  writeActiveProfileId,
  type ProfileSummary,
} from '$lib/persistence/localStorage';
import { profileRepo, settingsRepo } from '$lib/persistence/repositories';

class ProfileState {
  active = $state<LearnerProfile | null>(null);
  settings = $state<ProfileSettings | null>(null);
  summaries = $state<ProfileSummary[]>([]);
  loaded = $state(false);

  async init(): Promise<void> {
    this.summaries = readProfileIndex().profiles;
    const id = readActiveProfileId();
    if (id) {
      const profile = await profileRepo.get(id);
      if (profile) {
        this.active = profile;
        this.settings = await settingsRepo.get(profile.id);
      } else {
        writeActiveProfileId(null);
      }
    }
    this.loaded = true;
  }

  async create(
    input: { name: string; age: number; locale: Locale },
    config: HorizonConfig,
    contentVersion: string
  ): Promise<LearnerProfile> {
    const profile = buildProfile(input, config, contentVersion);
    await profileRepo.put(profile);
    await this.open(profile.id);
    return profile;
  }

  async open(id: string): Promise<void> {
    const profile = await profileRepo.get(id);
    if (!profile) return;
    this.active = profile;
    this.settings = await settingsRepo.get(profile.id);
    writeActiveProfileId(profile.id);
    upsertProfileSummary(toSummary(profile));
    this.summaries = readProfileIndex().profiles;
  }

  close(): void {
    this.active = null;
    this.settings = null;
    writeActiveProfileId(null);
  }

  private async save(profile: LearnerProfile): Promise<void> {
    await profileRepo.put($state.snapshot(profile) as LearnerProfile);
    this.active = profile;
    upsertProfileSummary(toSummary(profile));
    this.summaries = readProfileIndex().profiles;
  }

  async updateAge(age: number, config: HorizonConfig): Promise<void> {
    if (!this.active) return;
    await this.save(withAge(this.active, age, config));
  }

  async confirmAge(): Promise<void> {
    if (!this.active) return;
    await this.save(confirmAge(this.active));
  }

  async setStageOverride(stage: Stage | undefined): Promise<void> {
    if (!this.active) return;
    const next = { ...this.active, stageOverride: stage, updatedAt: new Date().toISOString() };
    if (!stage) delete next.stageOverride;
    await this.save(next);
  }

  async setLocale(locale: Locale): Promise<void> {
    if (!this.active || this.active.preferredLocale === locale) return;
    await this.save({
      ...this.active,
      preferredLocale: locale,
      updatedAt: new Date().toISOString(),
    });
  }

  async remove(id: string): Promise<void> {
    await profileRepo.deleteCascade(id);
    removeProfileSummary(id);
    if (this.active?.id === id) this.close();
    this.summaries = readProfileIndex().profiles;
  }

  async saveSettings(patch: Partial<ProfileSettings>): Promise<void> {
    if (!this.active) return;
    const next = {
      ...(this.settings ?? { learnerId: this.active.id, savedForLater: [], updatedAt: '' }),
      ...patch,
    };
    await settingsRepo.put($state.snapshot(next) as ProfileSettings);
    this.settings = next;
  }

  async toggleSavedForLater(nodeId: string): Promise<void> {
    const list = this.settings?.savedForLater ?? [];
    const next = list.includes(nodeId) ? list.filter((n) => n !== nodeId) : [...list, nodeId];
    await this.saveSettings({ savedForLater: next });
  }

  async setLastVisited(kind: 'node' | 'mission', id: string): Promise<void> {
    if (!this.active) return;
    if (this.settings?.lastVisited?.id === id) return;
    await this.saveSettings({ lastVisited: { kind, id, at: new Date().toISOString() } });
  }

  horizon(config: HorizonConfig): Horizon | null {
    return this.active ? effectiveHorizon(this.active, config) : null;
  }

  ageConfirmationDue(config: HorizonConfig): boolean {
    return !!this.active && needsAgeConfirmation(this.active, config.ageConfirmationDays);
  }
}

export const profile = new ProfileState();

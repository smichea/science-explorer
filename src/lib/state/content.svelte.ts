import type { ContentPackage } from '$lib/content-schema';
import { loadContentPackage } from '$lib/domain/content/package';
import { GraphIndex } from '$lib/domain/graph';
import { packageRepo } from '$lib/persistence/repositories';

class ContentState {
  status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  error = $state<string | null>(null);
  pkg = $state.raw<ContentPackage | null>(null);
  graph = $state.raw<GraphIndex | null>(null);

  async load(base: string): Promise<void> {
    if (this.status === 'ready' || this.status === 'loading') return;
    this.status = 'loading';
    try {
      const pkg = await loadContentPackage(base);
      this.pkg = pkg;
      this.graph = new GraphIndex(pkg.graph, pkg.missions, pkg.search);
      this.status = 'ready';
      packageRepo.record(pkg.manifest.id, pkg.manifest.version).catch(() => undefined);
    } catch (e) {
      this.error = (e as Error).message;
      this.status = 'error';
    }
  }

  /** Throws when used before the package is loaded — pages are only rendered once it is ready. */
  get ready(): { pkg: ContentPackage; graph: GraphIndex } {
    if (!this.pkg || !this.graph) throw new Error('content package not loaded');
    return { pkg: this.pkg, graph: this.graph };
  }
}

export const content = new ContentState();

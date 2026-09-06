import type {
  CompiledEdge,
  CompiledGraph,
  CompiledNode,
  CompiledRegion,
  CompiledWorld,
  EdgeType,
  Locale,
  MissionDefinition,
  SearchEntry,
} from '../content-schema';

export interface Neighbour {
  node: CompiledNode;
  edge: CompiledEdge;
  direction: 'out' | 'in';
}

export interface SearchHit {
  entry: SearchEntry;
  node?: CompiledNode;
  region?: CompiledRegion;
  world?: CompiledWorld;
  score: number;
}

function normalise(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** In-memory graph index with the queries of TECHNICAL_ARCHITECTURE §11 (no remote graph database). */
export class GraphIndex {
  readonly nodesById = new Map<string, CompiledNode>();
  readonly regionsById = new Map<string, CompiledRegion>();
  readonly worldsById = new Map<string, CompiledWorld>();
  readonly edgesById = new Map<string, CompiledEdge>();
  readonly edgesFrom = new Map<string, CompiledEdge[]>();
  readonly edgesTo = new Map<string, CompiledEdge[]>();
  readonly missionsById = new Map<string, MissionDefinition>();
  readonly nodesByRegion = new Map<string, CompiledNode[]>();

  constructor(
    readonly graph: CompiledGraph,
    missions: MissionDefinition[],
    readonly search: Record<Locale, SearchEntry[]>
  ) {
    for (const n of graph.nodes) this.nodesById.set(n.id, n);
    for (const r of graph.regions) this.regionsById.set(r.id, r);
    for (const w of graph.worlds) this.worldsById.set(w.id, w);
    for (const e of graph.edges) {
      this.edgesById.set(e.id, e);
      this.edgesFrom.set(e.from, [...(this.edgesFrom.get(e.from) ?? []), e]);
      this.edgesTo.set(e.to, [...(this.edgesTo.get(e.to) ?? []), e]);
    }
    for (const m of missions) this.missionsById.set(m.id, m);
    for (const n of graph.nodes) {
      if (!n.region) continue;
      this.nodesByRegion.set(n.region, [...(this.nodesByRegion.get(n.region) ?? []), n]);
    }
  }

  getNode(id: string): CompiledNode | undefined {
    return this.nodesById.get(id);
  }

  getRegion(id: string): CompiledRegion | undefined {
    return this.regionsById.get(id);
  }

  getWorld(id: string): CompiledWorld | undefined {
    return this.worldsById.get(id);
  }

  regionOf(node: CompiledNode): CompiledRegion | undefined {
    if (node.region) return this.regionsById.get(node.region);
    if (node.anchorNode) {
      const anchor = this.nodesById.get(node.anchorNode);
      return anchor ? this.regionOf(anchor) : undefined;
    }
    return undefined;
  }

  worldOf(node: CompiledNode): CompiledWorld | undefined {
    if (node.world) return this.worldsById.get(node.world);
    const region = this.regionOf(node);
    return region?.worldId ? this.worldsById.get(region.worldId) : undefined;
  }

  getNeighbours(
    id: string,
    types?: EdgeType[],
    direction: 'out' | 'in' | 'both' = 'both'
  ): Neighbour[] {
    const out: Neighbour[] = [];
    if (direction !== 'in') {
      for (const e of this.edgesFrom.get(id) ?? []) {
        if (types && !types.includes(e.type)) continue;
        const node = this.nodesById.get(e.to);
        if (node) out.push({ node, edge: e, direction: 'out' });
      }
    }
    if (direction !== 'out') {
      for (const e of this.edgesTo.get(id) ?? []) {
        if (types && !types.includes(e.type)) continue;
        const node = this.nodesById.get(e.from);
        if (node) out.push({ node, edge: e, direction: 'in' });
      }
    }
    return out;
  }

  /** Direct prerequisites of a node (edges point from the prerequisite to the dependent node). */
  /**
   * Prerequisites of a node; with a depth, only the edges that apply at that depth (an edge with a
   * `depthRange` starting above it belongs to a later year of the node).
   */
  prerequisitesOf(
    id: string,
    depth?: number
  ): { essential: CompiledNode[]; recommended: CompiledNode[] } {
    const applies = (edge: { depthRange?: [number, number] }) =>
      depth === undefined || !edge.depthRange || edge.depthRange[0] <= depth;
    const essential = this.getNeighbours(id, ['requires_essentially'], 'in')
      .filter((n) => applies(n.edge))
      .map((n) => n.node);
    const recommended = this.getNeighbours(id, ['requires_recommended'], 'in')
      .filter((n) => applies(n.edge))
      .map((n) => n.node);
    return { essential, recommended };
  }

  /** Every prerequisite reachable from the destination, topologically ordered (foundations first). */
  prerequisiteClosure(
    id: string,
    kinds: EdgeType[] = ['requires_essentially', 'requires_recommended']
  ): CompiledNode[] {
    const visited = new Set<string>();
    const order: CompiledNode[] = [];
    const visit = (nodeId: string) => {
      for (const e of this.edgesTo.get(nodeId) ?? []) {
        if (!kinds.includes(e.type) || visited.has(e.from)) continue;
        visited.add(e.from);
        visit(e.from);
        const node = this.nodesById.get(e.from);
        if (node) order.push(node);
      }
    };
    visit(id);
    return order;
  }

  /** Nodes that depend on this one (what it unlocks). */
  dependentsOf(id: string): CompiledNode[] {
    return this.getNeighbours(id, ['requires_essentially', 'requires_recommended'], 'out').map(
      (n) => n.node
    );
  }

  /** Coverage-eligible applications of a tool. */
  getApplications(toolId: string): Array<{ phenomenon: CompiledNode; edge: CompiledEdge }> {
    return (this.edgesFrom.get(toolId) ?? [])
      .filter((e) => e.type === 'applies_to' && e.coverageEligible)
      .map((edge) => ({ phenomenon: this.nodesById.get(edge.to)!, edge }))
      .filter((a) => a.phenomenon);
  }

  /** Tools that can be applied to a phenomenon. */
  getToolsFor(phenomenonId: string): Array<{ tool: CompiledNode; edge: CompiledEdge }> {
    return (this.edgesTo.get(phenomenonId) ?? [])
      .filter((e) => e.type === 'applies_to')
      .map((edge) => ({ tool: this.nodesById.get(edge.from)!, edge }))
      .filter((a) => a.tool);
  }

  getHistoricalMissions(nodeId: string): MissionDefinition[] {
    const ids = new Set<string>();
    for (const e of this.edgesFrom.get(nodeId) ?? [])
      if (e.type === 'appears_in_mission') ids.add(e.to);
    for (const m of this.missionsById.values()) {
      if (
        m.learning.phenomena.includes(nodeId) ||
        m.learning.toolsIntroduced.includes(nodeId) ||
        m.learning.toolsUsed.includes(nodeId) ||
        m.learning.nodesAssessed.includes(nodeId) ||
        m.historicalContext.people.includes(nodeId) ||
        m.historicalContext.places.includes(nodeId)
      )
        ids.add(m.id);
    }
    return [...ids]
      .map((id) => this.missionsById.get(id))
      .filter((m): m is MissionDefinition => !!m);
  }

  getMission(id: string): MissionDefinition | undefined {
    return this.missionsById.get(id);
  }

  nodesOfRegion(regionId: string): CompiledNode[] {
    return this.nodesByRegion.get(regionId) ?? [];
  }

  /** Nodes anchored (directly or through a chain) to the given node. */
  satellitesOf(nodeId: string): CompiledNode[] {
    return this.graph.nodes.filter((n) => n.anchorNode === nodeId);
  }

  /** Prefix and substring search over the compiled index; returns canonical targets. */
  searchText(query: string, locale: Locale, limit = 12): SearchHit[] {
    const q = normalise(query.trim());
    if (q.length < 2) return [];
    const words = q.split(/\s+/);
    const hits: SearchHit[] = [];
    for (const entry of this.search[locale]) {
      const text = normalise(entry.text);
      let score = 0;
      if (text === q) score = 100;
      else if (text.startsWith(q)) score = 60;
      else if (text.includes(q)) score = 40;
      else if (words.every((w) => entry.terms.some((t) => t.startsWith(w)))) score = 25;
      else if (words.some((w) => entry.terms.some((t) => t.startsWith(w)))) score = 10;
      if (score === 0) continue;
      if (entry.kind === 'node' || entry.kind === 'mission') score += 5;
      hits.push({
        entry,
        node: this.nodesById.get(entry.target),
        region: this.regionsById.get(entry.target),
        world: this.worldsById.get(entry.target),
        score,
      });
    }
    // Deduplicate by target (glossary aliases resolve to the same node).
    const best = new Map<string, SearchHit>();
    for (const h of hits) {
      const prev = best.get(h.entry.target);
      if (!prev || prev.score < h.score) best.set(h.entry.target, h);
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

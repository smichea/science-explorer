import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { CompiledLayout, CompiledNode, Locale, Vec3 } from '$lib/content-schema';
import type { GraphIndex } from '$lib/domain/graph';
import type { PerformanceMode } from '$lib/persistence/localStorage';
import {
  BRIDGE_COLOR,
  ROUTE_COLORS,
  ROUTE_DASHED,
  colorOfRegion,
  type NodeStyle,
  type RouteKind,
  type RouteStyle,
} from './styles';
import {
  FOCUS_DISTANCE,
  LABEL_BUDGET,
  MAX_CAMERA_DISTANCE,
  overviewDistance,
  zoomLevelForDistance,
  type ZoomLevel,
} from './zoom';

/** What the primary drag (left button, one finger) does. */
export type DragMode = 'rotate' | 'pan';

export interface FocusTarget {
  kind: 'universe' | 'world' | 'region' | 'node';
  id?: string;
}

export interface AtlasCallbacks {
  onSelect(id: string | null, kind: 'node' | 'region' | 'world'): void;
  onHover(id: string | null): void;
  onZoom(level: ZoomLevel): void;
  /** Localised label text for a node, region, world or the bridge hub ("hub"). */
  labelText(id: string, kind: 'node' | 'region' | 'world' | 'hub'): string;
}

interface Pickable {
  id: string;
  kind: 'node' | 'region' | 'world';
}

interface LabelEntry {
  object: CSS2DObject;
  element: HTMLDivElement;
  textEl: HTMLSpanElement;
  glyphEl: HTMLSpanElement;
  kind: 'node' | 'region' | 'world' | 'hub';
  id: string;
  priority: number;
  base: number;
  position: THREE.Vector3;
}

const STATUS_COLORS: Record<string, string> = {
  discovered: '#a7b0c8',
  practised: '#7f9cff',
  mastered: '#ffd166',
  due_for_review: '#ff8fab',
  in_progress: '#5ee6a8',
  saved: '#ffd166',
};

function toVec(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function geometryFor(node: CompiledNode): THREE.BufferGeometry {
  switch (node.type) {
    case 'mathematical_tool':
      return new THREE.OctahedronGeometry(1, 0);
    case 'mathematical_concept':
      return new THREE.SphereGeometry(0.85, 20, 14);
    case 'phenomenon':
      return new THREE.IcosahedronGeometry(0.95, 0);
    case 'law':
      return new THREE.TetrahedronGeometry(1.1, 0);
    case 'model':
      return new THREE.BoxGeometry(1.3, 1.3, 1.3);
    case 'method':
      return new THREE.ConeGeometry(0.85, 1.6, 6);
    case 'question':
      return new THREE.TorusKnotGeometry(0.55, 0.2, 48, 8);
    case 'person':
      return new THREE.CapsuleGeometry(0.5, 0.8, 4, 10);
    case 'place':
      return new THREE.CylinderGeometry(0.9, 0.9, 0.35, 12);
    case 'period':
      return new THREE.TorusGeometry(0.8, 0.22, 8, 24);
    case 'mission':
      return new THREE.DodecahedronGeometry(1.15, 0);
    default:
      return new THREE.SphereGeometry(0.8, 16, 12);
  }
}

function radialTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Data-driven Three.js scene of the knowledge universe (TECHNICAL_ARCHITECTURE §12). */
export class AtlasScene {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pickables: THREE.Object3D[] = [];
  private nodeMeshes = new Map<string, THREE.Mesh>();
  private nodeRings = new Map<string, THREE.Object3D[]>();
  private regionMeshes = new Map<string, THREE.Mesh>();
  private labels: LabelEntry[] = [];
  private routeGroup = new THREE.Group();
  private effectsGroup = new THREE.Group();
  private starfield: THREE.Points | null = null;
  private nebulae: THREE.Sprite[] = [];
  private frame = 0;
  private needsRender = true;
  private tween: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    start: number;
    duration: number;
  } | null = null;
  private hovered: string | null = null;
  private pulsing = false;
  private level: ZoomLevel = 'universe';
  private disposed = false;
  private pointerDown: { x: number; y: number } | null = null;
  private styles = new Map<string, NodeStyle>();
  private glowTexture: THREE.Texture;
  private lastLabelUpdate = 0;
  private dragMode: DragMode = 'rotate';
  /** Radius of the authored universe: frames the overview and bounds panning. */
  private universeRadius: number;

  constructor(
    private container: HTMLElement,
    private graph: GraphIndex,
    private layout: CompiledLayout,
    private locale: Locale,
    private performance: PerformanceMode,
    private reducedMotion: boolean,
    private callbacks: AtlasCallbacks
  ) {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({
      antialias: performance !== 'reduced',
      powerPreference: performance === 'high' ? 'high-performance' : 'default',
    });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    const labelDom = this.labelRenderer.domElement;
    labelDom.style.position = 'absolute';
    labelDom.style.inset = '0';
    labelDom.style.pointerEvents = 'none';
    labelDom.setAttribute('aria-hidden', 'true');
    container.appendChild(labelDom);

    this.scene.background = new THREE.Color(0x070b17);
    this.scene.fog = new THREE.FogExp2(0x070b17, 0.0028);
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 2500);
    this.camera.position.set(0, 120, 165);
    this.universeRadius = Math.max(40, layout.bounds.radius);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = MAX_CAMERA_DISTANCE;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    // Panning slides the view parallel to the screen (map-like), never through the floor plane.
    this.controls.screenSpacePanning = true;
    this.controls.keyPanSpeed = 14;
    // Arrow keys pan only while the atlas itself has the focus (never stolen from the search box).
    this.controls.listenToKeyEvents(container);
    this.setDragMode(this.dragMode);
    this.controls.addEventListener('change', () => {
      this.clampPan();
      this.needsRender = true;
    });
    this.controls.addEventListener('start', () => (this.needsRender = true));

    this.glowTexture = radialTexture();
    this.buildLights();
    this.buildBackground();
    this.buildWorlds();
    this.buildRegions();
    this.buildNodes();
    this.scene.add(this.routeGroup);
    this.scene.add(this.effectsGroup);

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.loop();
  }

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  private pixelRatio(): number {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (this.performance === 'high') return Math.min(2, dpr);
    if (this.performance === 'balanced') return Math.min(1.5, dpr);
    return 1;
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0x8fa0d0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(60, 120, 80);
    this.scene.add(sun);
    const core = new THREE.PointLight(0xfff1d0, 40, 120, 1.2);
    core.position.set(0, 6, 0);
    this.scene.add(core);
  }

  private buildBackground() {
    if (this.performance === 'reduced') return;
    const count = this.performance === 'high' ? 2600 : 1400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 520 + Math.random() * 420;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const tint = 0.7 + Math.random() * 0.3;
      colors[i * 3] = tint;
      colors[i * 3 + 1] = tint * (0.9 + Math.random() * 0.1);
      colors[i * 3 + 2] = 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      fog: false,
    });
    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);

    for (const world of this.graph.graph.worlds) {
      const centre = this.layout.worlds[world.id];
      if (!centre) continue;
      const material = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: new THREE.Color(world.color),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(toVec(centre));
      sprite.scale.set(95, 95, 1);
      this.scene.add(sprite);
      this.nebulae.push(sprite);
    }
  }

  private makeLabel(
    id: string,
    kind: LabelEntry['kind'],
    position: THREE.Vector3,
    base: number,
    extraClass = ''
  ): LabelEntry {
    const element = document.createElement('div');
    element.className = `atlas-label atlas-label--${kind} ${extraClass}`.trim();
    element.dataset.id = id;
    const glyphEl = document.createElement('span');
    glyphEl.className = 'atlas-label__glyph';
    const textEl = document.createElement('span');
    textEl.className = 'atlas-label__text';
    textEl.textContent = this.callbacks.labelText(id, kind);
    element.append(glyphEl, textEl);
    element.style.pointerEvents = 'auto';
    element.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (kind === 'hub') return;
      this.callbacks.onSelect(id, kind);
    });
    element.addEventListener('pointerenter', () => this.setHover(kind === 'node' ? id : null));
    element.addEventListener('pointerleave', () => this.setHover(null));
    const object = new CSS2DObject(element);
    object.position.copy(position);
    this.scene.add(object);
    const entry: LabelEntry = {
      object,
      element,
      textEl,
      glyphEl,
      kind,
      id,
      priority: base,
      base,
      position,
    };
    this.labels.push(entry);
    return entry;
  }

  private buildWorlds() {
    for (const world of this.graph.graph.worlds) {
      const centre = this.layout.worlds[world.id];
      if (!centre) continue;
      const colour = new THREE.Color(world.color);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(19.5, 0.14, 8, 96),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.55 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(toVec(centre));
      this.scene.add(ring);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(19.5, 64),
        new THREE.MeshBasicMaterial({
          color: colour,
          transparent: true,
          opacity: 0.06,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.copy(toVec(centre)).add(new THREE.Vector3(0, -0.6, 0));
      disc.userData = { id: world.id, kind: 'world' } satisfies Pickable;
      this.scene.add(disc);
      this.pickables.push(disc);
      this.makeLabel(world.id, 'world', toVec(centre).add(new THREE.Vector3(0, 7.5, 0)), 100);
    }
    // Bridge hub at the centre.
    const hub = new THREE.Mesh(
      new THREE.TorusGeometry(10.5, 0.1, 8, 80),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(BRIDGE_COLOR),
        transparent: true,
        opacity: 0.45,
      })
    );
    hub.rotation.x = Math.PI / 2;
    this.scene.add(hub);
    this.makeLabel('hub', 'hub', new THREE.Vector3(0, 6.5, 0), 90);
  }

  private buildRegions() {
    for (const region of this.graph.graph.regions) {
      const centre = this.layout.regions[region.id];
      if (!centre) continue;
      const colour = new THREE.Color(colorOfRegion(region, this.graph));
      const detailed = region.nodeIds.length > 0;
      const geometry = new THREE.CylinderGeometry(
        detailed ? 2.4 : 1.7,
        detailed ? 2.6 : 1.9,
        0.3,
        6
      );
      const material = detailed
        ? new THREE.MeshStandardMaterial({
            color: colour,
            emissive: colour,
            emissiveIntensity: 0.25,
            transparent: true,
            opacity: 0.85,
            roughness: 0.7,
          })
        : new THREE.MeshBasicMaterial({
            color: colour,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
          });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(toVec(centre)).add(new THREE.Vector3(0, -1.2, 0));
      mesh.userData = { id: region.id, kind: 'region' } satisfies Pickable;
      this.scene.add(mesh);
      this.pickables.push(mesh);
      this.regionMeshes.set(region.id, mesh);
      this.makeLabel(
        region.id,
        'region',
        toVec(centre).add(new THREE.Vector3(0, detailed ? 2.2 : 1.6, 0)),
        detailed ? 55 : 22,
        detailed ? '' : 'atlas-label--silhouette'
      );
    }
  }

  private buildNodes() {
    for (const node of this.graph.graph.nodes) {
      const position = this.layout.positions[node.id];
      if (!position) continue;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
        roughness: 0.45,
        metalness: 0.1,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometryFor(node), material);
      mesh.position.copy(toVec(position));
      mesh.userData = { id: node.id, kind: 'node' } satisfies Pickable;
      this.scene.add(mesh);
      this.pickables.push(mesh);
      this.nodeMeshes.set(node.id, mesh);
      this.makeLabel(
        node.id,
        'node',
        toVec(position).add(new THREE.Vector3(0, 1.9, 0)),
        node.importance * 10
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Updates from application state
  // ---------------------------------------------------------------------------

  setStyles(styles: Map<string, NodeStyle>, routes: RouteStyle[]): void {
    if (this.disposed) return;
    this.styles = styles;
    this.pulsing = false;
    for (const [id, mesh] of this.nodeMeshes) {
      const style = styles.get(id);
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!style) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const colour = new THREE.Color(style.color);
      material.color.copy(colour);
      material.emissive.copy(colour);
      material.emissiveIntensity = style.selected
        ? 1.0
        : style.highlighted
          ? 0.6
          : 0.3 * style.emphasis + 0.05;
      material.opacity = 0.3 + 0.7 * style.emphasis;
      const scale = style.size * (style.selected ? 1.25 : 1);
      mesh.scale.setScalar(scale);
      this.updateRings(id, mesh, style);
      const label = this.labels.find((l) => l.id === id && l.kind === 'node');
      if (label) {
        label.priority = style.labelPriority * 10 + (style.selected ? 10_000 : 0);
        label.glyphEl.textContent = style.glyph;
        label.element.classList.toggle('is-selected', style.selected);
        label.element.classList.toggle('is-highlighted', style.highlighted);
        label.element.style.opacity = String(0.45 + 0.55 * style.emphasis);
        label.element.style.setProperty('--label-color', style.color);
      }
    }
    this.buildRoutes(routes);
    this.needsRender = true;
    this.updateLabels(true);
  }

  private updateRings(id: string, mesh: THREE.Mesh, style: NodeStyle) {
    for (const old of this.nodeRings.get(id) ?? []) {
      this.effectsGroup.remove(old);
      (old as THREE.Mesh).geometry?.dispose();
      const m = (old as THREE.Mesh).material as THREE.Material | undefined;
      m?.dispose();
    }
    const rings: THREE.Object3D[] = [];
    const radius = 1.45 * style.size;
    const colour = STATUS_COLORS[style.kind];
    const addRing = (r: number, tube: number, color: string, opacity = 0.9) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, tube, 6, 40),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(mesh.position);
      this.effectsGroup.add(ring);
      rings.push(ring);
    };
    if (style.kind === 'discovered') addRing(radius, 0.05, colour, 0.7);
    else if (style.kind === 'practised') addRing(radius, 0.1, colour);
    else if (style.kind === 'mastered') {
      addRing(radius, 0.1, colour);
      addRing(radius + 0.4, 0.05, colour, 0.7);
    } else if (style.kind === 'due_for_review') {
      const curve = new THREE.EllipseCurve(
        0,
        0,
        radius + 0.2,
        radius + 0.2,
        0,
        Math.PI * 2,
        false,
        0
      );
      const points = curve.getPoints(48).map((p) => new THREE.Vector3(p.x, 0, p.y));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geometry,
        new THREE.LineDashedMaterial({
          color: new THREE.Color(colour),
          dashSize: 0.5,
          gapSize: 0.3,
        })
      );
      line.computeLineDistances();
      line.position.copy(mesh.position);
      this.effectsGroup.add(line);
      rings.push(line);
    } else if (style.kind === 'in_progress') {
      addRing(radius + 0.2, 0.12, colour);
      rings[rings.length - 1].userData.pulse = true;
      this.pulsing = !this.reducedMotion;
    } else if (style.kind === 'saved') {
      const flag = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.8, 4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(colour) })
      );
      flag.position.copy(mesh.position).add(new THREE.Vector3(0, style.size + 1.1, 0));
      flag.rotation.x = Math.PI;
      this.effectsGroup.add(flag);
      rings.push(flag);
    }
    if (style.selected) {
      addRing(radius + 0.7, 0.08, '#ffffff', 0.95);
    }
    this.nodeRings.set(id, rings);
  }

  private buildRoutes(routes: RouteStyle[]) {
    for (const child of [...this.routeGroup.children]) {
      this.routeGroup.remove(child);
      const line = child as THREE.LineSegments;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    const byKind = new Map<RouteKind, { positions: number[]; colors: number[] }>();
    for (const route of routes) {
      const a = this.layout.positions[route.from];
      const b = this.layout.positions[route.to];
      if (!a || !b) continue;
      const bucket = byKind.get(route.kind) ?? { positions: [], colors: [] };
      byKind.set(route.kind, bucket);
      const start = toVec(a);
      const end = toVec(b);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += 1 + start.distanceTo(end) * 0.16;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(12);
      const colour = new THREE.Color(ROUTE_COLORS[route.kind]).multiplyScalar(
        0.25 + 0.75 * route.emphasis
      );
      for (let i = 0; i < points.length - 1; i++) {
        bucket.positions.push(
          points[i].x,
          points[i].y,
          points[i].z,
          points[i + 1].x,
          points[i + 1].y,
          points[i + 1].z
        );
        bucket.colors.push(colour.r, colour.g, colour.b, colour.r, colour.g, colour.b);
      }
    }
    for (const [kind, bucket] of byKind) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
      const material = ROUTE_DASHED[kind]
        ? new THREE.LineDashedMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            dashSize: 0.9,
            gapSize: 0.6,
          })
        : new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
      const line = new THREE.LineSegments(geometry, material);
      if (ROUTE_DASHED[kind]) line.computeLineDistances();
      this.routeGroup.add(line);
    }
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    for (const label of this.labels)
      label.textEl.textContent = this.callbacks.labelText(label.id, label.kind);
    this.needsRender = true;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    this.controls.enableDamping = !value;
    if (value) this.pulsing = false;
    this.needsRender = true;
  }

  /** Rotate (default) or pan with the primary drag; the other gesture stays on the secondary. */
  setDragMode(mode: DragMode): void {
    this.dragMode = mode;
    const pan = mode === 'pan';
    this.controls.mouseButtons = {
      LEFT: pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: pan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
    };
    this.controls.touches = {
      ONE: pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
      TWO: pan ? THREE.TOUCH.DOLLY_ROTATE : THREE.TOUCH.DOLLY_PAN,
    };
    this.renderer.domElement.style.cursor = pan ? 'move' : 'grab';
  }

  /** Keeps the orbit target inside the universe so a long pan can never lose the map. */
  private clampPan(): void {
    const limit = this.universeRadius * 1.15;
    const target = this.controls.target;
    const length = target.length();
    if (length <= limit) return;
    const excess = target.clone().multiplyScalar(1 - limit / length);
    target.sub(excess);
    this.camera.position.sub(excess);
  }

  setPerformance(mode: PerformanceMode): void {
    if (mode === this.performance) return;
    this.performance = mode;
    this.renderer.setPixelRatio(this.pixelRatio());
    if (this.starfield) this.starfield.visible = mode !== 'reduced';
    for (const n of this.nebulae) n.visible = mode !== 'reduced';
    this.needsRender = true;
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  private targetPosition(target: FocusTarget): { centre: THREE.Vector3; distance: number } | null {
    if (target.kind === 'universe')
      return {
        centre: new THREE.Vector3(0, 0, 0),
        distance: overviewDistance(this.universeRadius, this.camera.fov, this.camera.aspect),
      };
    if (target.kind === 'world' && target.id) {
      const c = this.layout.worlds[target.id];
      return c ? { centre: toVec(c), distance: FOCUS_DISTANCE.world } : null;
    }
    if (target.kind === 'region' && target.id) {
      const c = this.layout.regions[target.id];
      return c ? { centre: toVec(c), distance: FOCUS_DISTANCE.region } : null;
    }
    if (target.kind === 'node' && target.id) {
      const c = this.layout.positions[target.id];
      if (!c) return null;
      const node = this.graph.getNode(target.id);
      return {
        centre: toVec(c),
        distance: node?.type === 'mission' ? FOCUS_DISTANCE.mission : FOCUS_DISTANCE.node,
      };
    }
    return null;
  }

  focus(target: FocusTarget, animate = true): void {
    if (this.disposed) return;
    const resolved = this.targetPosition(target);
    if (!resolved) return;
    const { centre, distance } = resolved;
    const direction = this.camera.position.clone().sub(this.controls.target);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0.8, 1);
    direction.normalize();
    // Keep a pleasant elevation: never look from straight above or from below the plane.
    if (target.kind === 'universe') direction.set(0, 0.62, 0.78).normalize();
    else direction.y = Math.max(0.35, Math.min(0.8, direction.y));
    direction.normalize();
    const to = centre.clone().add(direction.multiplyScalar(distance));
    if (!animate || this.reducedMotion) {
      this.camera.position.copy(to);
      this.controls.target.copy(centre);
      this.controls.update();
      this.needsRender = true;
      return;
    }
    this.tween = {
      from: this.camera.position.clone(),
      to,
      fromTarget: this.controls.target.clone(),
      toTarget: centre,
      start: window.performance.now(),
      duration: 950,
    };
    this.needsRender = true;
  }

  resize(): void {
    if (this.disposed) return;
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
    this.needsRender = true;
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  private setPointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pick(): Pickable | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const hit of hits) {
      const data = hit.object.userData as Pickable;
      if (!data?.id) continue;
      if (data.kind === 'node') {
        const style = this.styles.get(data.id);
        if (style && style.emphasis < 0.2) continue;
      }
      return data;
    }
    return null;
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
    this.setPointer(event);
    const hit = this.pick();
    if (hit) this.callbacks.onSelect(hit.id, hit.kind);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    this.setPointer(event);
    const hit = this.pick();
    this.setHover(hit?.kind === 'node' ? hit.id : null);
    this.renderer.domElement.style.cursor = hit
      ? 'pointer'
      : this.dragMode === 'pan'
        ? 'move'
        : 'grab';
  };

  private onPointerLeave = () => this.setHover(null);

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.container.dispatchEvent(new CustomEvent('atlas-context-lost', { bubbles: true }));
  };

  private setHover(id: string | null) {
    if (id === this.hovered) return;
    const previous = this.hovered ? this.nodeMeshes.get(this.hovered) : undefined;
    if (previous)
      (previous.material as THREE.MeshStandardMaterial).emissiveIntensity = this.styles.get(
        this.hovered!
      )?.selected
        ? 1
        : 0.3;
    this.hovered = id;
    const next = id ? this.nodeMeshes.get(id) : undefined;
    if (next) (next.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9;
    this.callbacks.onHover(id);
    this.needsRender = true;
  }

  // ---------------------------------------------------------------------------
  // Labels and semantic zoom
  // ---------------------------------------------------------------------------

  private updateLabels(force = false) {
    const now = window.performance.now();
    if (!force && now - this.lastLabelUpdate < 120) return;
    this.lastLabelUpdate = now;
    const level = this.level;
    const compact = this.container.clientWidth < 600;
    const budget = compact ? Math.ceil(LABEL_BUDGET[level] * 0.55) : LABEL_BUDGET[level];
    const target = this.controls.target;
    const candidates: Array<{ label: LabelEntry; score: number }> = [];
    for (const label of this.labels) {
      let score = label.priority;
      const distance = label.position.distanceTo(target);
      if (label.kind === 'node') {
        if (level === 'universe') score *= 0.06;
        else if (level === 'world') score *= 0.45;
        score *= 1 / (1 + distance / 40);
        const style = this.styles.get(label.id);
        if (style && style.emphasis < 0.32 && !style.selected) score *= 0.2;
      } else if (label.kind === 'region') {
        if (level === 'universe') score *= 0.3;
        if (level === 'concept') score *= 0.4;
        if (label.element.classList.contains('atlas-label--silhouette')) score *= 0.5;
        score *= 1 / (1 + distance / 90);
      } else {
        score *= 1 / (1 + distance / 200);
      }
      candidates.push({ label, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const occupied = new Set<string>();
    let shown = 0;
    const tmp = new THREE.Vector3();
    for (const { label } of candidates) {
      let visible = shown < budget;
      if (visible) {
        tmp.copy(label.position).project(this.camera);
        if (tmp.z > 1) visible = false;
        else {
          const x = ((tmp.x + 1) / 2) * rect.width;
          const y = ((1 - tmp.y) / 2) * rect.height;
          const key = `${Math.round(x / 150)}:${Math.round(y / 34)}`;
          const isSelected = label.kind === 'node' && this.styles.get(label.id)?.selected;
          if (occupied.has(key) && !isSelected && label.kind !== 'world') visible = false;
          else occupied.add(key);
        }
      }
      label.object.visible = visible;
      if (visible) shown++;
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = window.performance.now();
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration);
      const k = easeInOutCubic(t);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, k);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, k);
      if (t >= 1) this.tween = null;
      this.needsRender = true;
    }
    if (this.pulsing) {
      const s = 1 + 0.12 * Math.sin(now / 350);
      for (const rings of this.nodeRings.values())
        for (const r of rings) if (r.userData.pulse) r.scale.setScalar(s);
      this.needsRender = true;
    }
    if (this.controls.enableDamping) this.controls.update();
    const distance = this.camera.position.distanceTo(this.controls.target);
    const level = zoomLevelForDistance(distance);
    if (level !== this.level) {
      this.level = level;
      this.callbacks.onZoom(level);
      this.needsRender = true;
      this.updateLabels(true);
    }
    if (!this.needsRender) return;
    this.needsRender = false;
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose?.();
    });
    this.glowTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
    this.labels = [];
  }
}

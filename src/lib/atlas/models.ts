import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small scientific sculptures, built locally without textures or model downloads. */
export function scientificModel(key: string, material: THREE.MeshStandardMaterial): THREE.Mesh {
  const root = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), material);
  const add = (geometry: THREE.BufferGeometry, position = new THREE.Vector3()) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    root.add(mesh);
    return mesh;
  };
  const rod = (a: THREE.Vector3, b: THREE.Vector3, radius = 0.055) => {
    const mesh = add(
      new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8),
      a.clone().add(b).multiplyScalar(0.5)
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  const orbit = (radius: number, x: number, z: number) => {
    const ring = add(new THREE.TorusGeometry(radius, 0.035, 6, 64));
    ring.rotation.set(x, 0, z);
  };
  const curve = (points: THREE.Vector3[], radius = 0.065) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, radius, 6, false));
  const axes = () => {
    rod(new THREE.Vector3(-1.3, -0.75, 0), new THREE.Vector3(1.3, -0.75, 0));
    rod(new THREE.Vector3(-1.3, -0.75, 0), new THREE.Vector3(-1.3, 1.1, 0));
  };
  if (/derivative|rate_of_change|tangent/.test(key)) {
    axes();
    curve(
      Array.from({ length: 25 }, (_, i) => {
        const x = i / 12 - 1;
        return new THREE.Vector3(x * 1.2, x * x - 0.5, 0);
      })
    );
    rod(new THREE.Vector3(-0.6, -1.25, 0.08), new THREE.Vector3(1.2, 0.25, 0.08), 0.055);
    add(new THREE.SphereGeometry(0.12, 12, 8), new THREE.Vector3(0.6, -0.25, 0.08));
  } else if (/integral|primitive|probability|statistics|sequence|series/.test(key)) {
    axes();
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) / 4;
      const height = 1.6 * Math.exp(-2.5 * x * x);
      add(new THREE.BoxGeometry(0.2, height, 0.38), new THREE.Vector3(x, height / 2 - 0.75, 0));
    }
  } else if (/vector|geometry|linear_algebra/.test(key)) {
    for (const endpoint of [
      new THREE.Vector3(1.2, 0, 0),
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(0, 0, 1.2),
    ]) {
      const start = new THREE.Vector3(-0.5, -0.5, -0.5);
      rod(start, endpoint, 0.07);
      const head = add(new THREE.ConeGeometry(0.18, 0.4, 12), endpoint);
      head.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        endpoint.clone().sub(start).normalize()
      );
    }
  } else if (/circuit|electricity|rc_/.test(key)) {
    const corners = [
      new THREE.Vector3(-1, -0.65, 0),
      new THREE.Vector3(1, -0.65, 0),
      new THREE.Vector3(1, 0.65, 0),
      new THREE.Vector3(-1, 0.65, 0),
    ];
    rod(corners[1], corners[2], 0.055);
    rod(corners[3], corners[0], 0.055);
    for (const sign of [-1, 1]) {
      rod(new THREE.Vector3(sign, -0.65, 0), new THREE.Vector3(sign * 0.15, -0.65, 0), 0.055);
      rod(new THREE.Vector3(sign, 0.65, 0), new THREE.Vector3(sign * 0.4, 0.65, 0), 0.055);
    }
    add(new THREE.BoxGeometry(0.8, 0.25, 0.3), new THREE.Vector3(0, 0.65, 0));
    for (const x of [-0.15, 0.15])
      add(new THREE.BoxGeometry(0.06, 0.65, 0.5), new THREE.Vector3(x, -0.65, 0));
  } else if (/reaction|acid|redox|stoichiometry|thermochemistry/.test(key)) {
    const profile = [
      new THREE.Vector2(0, -1),
      new THREE.Vector2(0.85, -1),
      new THREE.Vector2(0.9, -0.8),
      new THREE.Vector2(0.27, 0.45),
      new THREE.Vector2(0.27, 1),
      new THREE.Vector2(0.34, 1.05),
    ];
    add(new THREE.LatheGeometry(profile, 24));
    const lip = add(new THREE.TorusGeometry(0.34, 0.035, 6, 32), new THREE.Vector3(0, 1.05, 0));
    lip.rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.12, 12, 8), new THREE.Vector3(0, 1.35, 0));
  } else if (/mission|person|place|period/.test(key)) {
    // An observatory telescope on its tripod.
    const tube = add(new THREE.CylinderGeometry(0.3, 0.4, 1.65, 16), new THREE.Vector3(0, 0.5, 0));
    tube.rotation.z = -Math.PI / 3;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      rod(
        new THREE.Vector3(0, 0.1, 0),
        new THREE.Vector3(Math.cos(a) * 0.8, -1, Math.sin(a) * 0.8),
        0.07
      );
    }
    orbit(0.31, 0, Math.PI / 6);
  } else if (/chemistry|atom|molecule|reaction|kinetic|acid|redox/.test(key)) {
    // Ball-and-stick tetrahedral molecular sculpture.
    const sites = [
      [0.85, 0.7, 0.65],
      [-0.85, 0.7, -0.65],
      [0.75, -0.7, -0.75],
      [-0.75, -0.7, 0.75],
    ];
    root.scale.setScalar(0.95);
    add(new THREE.SphereGeometry(0.42, 18, 12));
    for (const site of sites) {
      const point = new THREE.Vector3(...site);
      rod(new THREE.Vector3(), point, 0.085);
      add(new THREE.SphereGeometry(0.3, 16, 10), point);
    }
  } else if (/wave|oscillat|optics|signal/.test(key)) {
    for (const phase of [0, Math.PI]) {
      const points = Array.from({ length: 49 }, (_, i) => {
        const t = i / 48;
        return new THREE.Vector3(
          t * 2.6 - 1.3,
          Math.sin(t * Math.PI * 3 + phase) * 0.6,
          phase === 0 ? -0.2 : 0.2
        );
      });
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.06, 6, false));
    }
    rod(new THREE.Vector3(-1.4, -0.85, 0), new THREE.Vector3(1.4, -0.85, 0));
  } else if (/physics|motion|gravitation|field|quantum|energy/.test(key)) {
    // Armillary sphere with three inclined orbital tracks.
    add(new THREE.SphereGeometry(0.48, 24, 16));
    orbit(1.15, Math.PI / 2, 0);
    orbit(1.15, Math.PI / 3, Math.PI / 3);
    orbit(1.15, -Math.PI / 3, -Math.PI / 3);
    add(new THREE.SphereGeometry(0.17, 12, 8), new THREE.Vector3(1.15, 0, 0));
  } else {
    // A mathematical saddle surface: curved grid above a coordinate frame.
    for (let axis = 0; axis < 2; axis++) {
      for (let line = -3; line <= 3; line++) {
        const points = Array.from({ length: 25 }, (_, i) => {
          const u = i / 12 - 1;
          const v = line / 3;
          const x = axis === 0 ? u : v;
          const z = axis === 0 ? v : u;
          return new THREE.Vector3(x * 1.15, (x * x - z * z) * 0.65 + 0.2, z * 1.15);
        });
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.022, 4, false));
      }
    }
    rod(new THREE.Vector3(-1.4, -0.8, 0), new THREE.Vector3(1.4, -0.8, 0));
    rod(new THREE.Vector3(0, -0.8, -1.4), new THREE.Vector3(0, -0.8, 1.4));
    rod(new THREE.Vector3(0, -0.8, 0), new THREE.Vector3(0, 1.25, 0));
  }
  // One draw call per sculpture, also in the reduced performance mode.
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const part = object.geometry.clone().applyMatrix4(object.matrixWorld);
    parts.push(part);
    object.geometry.dispose();
  });
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return new THREE.Mesh(geometry ?? new THREE.SphereGeometry(0.5, 12, 8), material);
}

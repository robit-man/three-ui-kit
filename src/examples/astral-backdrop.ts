import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  type ColorRepresentation,
  Fog,
  LineSegments,
  MathUtils,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from "three";

const BASE_ATMOS_COLOR = new Color(0.08, 0.22, 0.52);

const GRID_FLICKER_DURATION = 0.25;
const GRID_FADE_DURATION = 0.45;
const GRID_DELAY_SCALE = 0.08;
const GRID_JITTER = 0.12;

export interface AstralBackdropOptions {
  scene: Scene;
  lineLength?: number;
  gridDistance?: number;
  lineColor?: ColorRepresentation;
  lineOpacity?: number;
  atmosphereColor?: ColorRepresentation;
  fogNear?: number;
  fogFar?: number;
  active?: boolean;
}

export class AstralBackdrop {
  private readonly _scene: Scene;
  private readonly _atmosphereColor = new Color();
  private readonly _fogDark = new Color(0x000000);
  private readonly _fogTarget = new Color();
  private readonly _fogWork = new Color();
  private readonly _gridMaterial: ShaderMaterial;
  private readonly _gridGeometry: BufferGeometry;
  private readonly _gridLines: LineSegments<BufferGeometry, ShaderMaterial>;
  private readonly _alphaAttr: BufferAttribute;
  private readonly _alphas: Float32Array;
  private readonly _delays: Float32Array;
  private readonly _jitters: Float32Array;
  private readonly _segmentCount: number;
  private readonly _atmosphereMaterial: ShaderMaterial;
  private readonly _atmosphereMesh: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly _fogNear: number;
  private readonly _fogFar: number;

  private _active = true;
  private _startTime: number | null = null;
  private _atmosphereAlpha = 0;
  private _fogAlpha = 0;

  constructor(opts: AstralBackdropOptions) {
    this._scene = opts.scene;
    this._active = opts.active ?? true;
    this._fogNear = Math.max(0.1, opts.fogNear ?? 8);
    this._fogFar = Math.max(this._fogNear + 0.1, opts.fogFar ?? 26);
    this._atmosphereColor.copy(
      opts.atmosphereColor ? new Color(opts.atmosphereColor) : BASE_ATMOS_COLOR
    );

    const {
      geometry,
      material,
      lines,
      alphaAttr,
      alphas,
      delays,
      jitters,
      segmentCount,
    } = this._createSectorGrid(
      opts.lineLength ?? 0.05,
      opts.gridDistance ?? 5,
      opts.lineColor ?? "#ffffff",
      opts.lineOpacity ?? 0.2
    );
    this._gridGeometry = geometry;
    this._gridMaterial = material;
    this._gridLines = lines;
    this._alphaAttr = alphaAttr;
    this._alphas = alphas;
    this._delays = delays;
    this._jitters = jitters;
    this._segmentCount = segmentCount;

    this._atmosphereMaterial = this._createAtmosphereMaterial();
    this._atmosphereMesh = new Mesh(
      new SphereGeometry(1, 64, 64),
      this._atmosphereMaterial
    );
    this._atmosphereMesh.scale.setScalar(60);
    this._atmosphereMesh.frustumCulled = false;

    this._scene.add(this._gridLines);
    this._scene.add(this._atmosphereMesh);
    this._enableFog();
  }

  setActive(active: boolean): void {
    this._active = active;
  }

  setAtmosphereColor(color: ColorRepresentation): void {
    this._atmosphereColor.set(color);
  }

  update(dt: number, elapsedTime: number): void {
    this._updateGrid(elapsedTime);
    this._updateAtmosphere(dt, elapsedTime);
    this._updateFog(dt);
  }

  dispose(): void {
    this._gridLines.removeFromParent();
    this._atmosphereMesh.removeFromParent();

    this._gridGeometry.dispose();
    this._gridMaterial.dispose();
    this._atmosphereMesh.geometry.dispose();
    this._atmosphereMaterial.dispose();

    this._scene.fog = null;
  }

  private _createSectorGrid(
    lineLength: number,
    gridDistance: number,
    lineColor: ColorRepresentation,
    lineOpacity: number
  ): {
    geometry: BufferGeometry;
    material: ShaderMaterial;
    lines: LineSegments<BufferGeometry, ShaderMaterial>;
    alphaAttr: BufferAttribute;
    alphas: Float32Array;
    delays: Float32Array;
    jitters: Float32Array;
    segmentCount: number;
  } {
    const gridSize = 2 * gridDistance + 1;
    const totalGridPoints = gridSize * gridSize * gridSize;
    const verticesPerPoint = 6;
    const totalVertices = totalGridPoints * verticesPerPoint;
    const totalSegments = totalVertices / 2;

    const positions = new Float32Array(totalVertices * 3);
    const alphas = new Float32Array(totalVertices);
    const delays = new Float32Array(totalSegments);
    const jitters = new Float32Array(totalSegments);

    const halfLength = lineLength * 0.5;
    let vertexIndex = 0;
    let segmentIndex = 0;

    for (let x = -gridDistance; x <= gridDistance; x++) {
      for (let y = -gridDistance; y <= gridDistance; y++) {
        for (let z = -gridDistance; z <= gridDistance; z++) {
          const dist = Math.sqrt(x * x + y * y + z * z);
          const delay = Math.max(
            0,
            dist * GRID_DELAY_SCALE + (Math.random() - 0.5) * GRID_JITTER
          );
          const jitter = Math.random() * Math.PI * 2;

          positions[vertexIndex++] = x - halfLength;
          positions[vertexIndex++] = y;
          positions[vertexIndex++] = z;
          positions[vertexIndex++] = x + halfLength;
          positions[vertexIndex++] = y;
          positions[vertexIndex++] = z;
          delays[segmentIndex] = delay;
          jitters[segmentIndex] = jitter;
          segmentIndex++;

          positions[vertexIndex++] = x;
          positions[vertexIndex++] = y - halfLength;
          positions[vertexIndex++] = z;
          positions[vertexIndex++] = x;
          positions[vertexIndex++] = y + halfLength;
          positions[vertexIndex++] = z;
          delays[segmentIndex] = delay;
          jitters[segmentIndex] = jitter;
          segmentIndex++;

          positions[vertexIndex++] = x;
          positions[vertexIndex++] = y;
          positions[vertexIndex++] = z - halfLength;
          positions[vertexIndex++] = x;
          positions[vertexIndex++] = y;
          positions[vertexIndex++] = z + halfLength;
          delays[segmentIndex] = delay;
          jitters[segmentIndex] = jitter;
          segmentIndex++;
        }
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const alphaAttr = new BufferAttribute(alphas, 1);
    geometry.setAttribute("alpha", alphaAttr);

    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new Color(lineColor) },
        uOpacity: { value: lineOpacity },
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * uOpacity);
        }
      `,
    });
    material.toneMapped = false;

    const lines = new LineSegments(geometry, material);
    lines.frustumCulled = false;

    return {
      geometry,
      material,
      lines,
      alphaAttr,
      alphas,
      delays,
      jitters,
      segmentCount: totalSegments,
    };
  }

  private _createAtmosphereMaterial(): ShaderMaterial {
    const material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      transparent: true,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: this._atmosphereColor.clone() },
        uGlobalAlpha: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform float uGlobalAlpha;

        float hash(vec3 p) {
          vec3 q = vec3(
            dot(p, vec3(127.1, 311.7, 74.7)),
            dot(p, vec3(269.5, 183.3, 246.1)),
            dot(p, vec3(113.5, 271.9, 124.6))
          );
          return fract(sin(q.x + q.y + q.z) * 43758.5453123);
        }

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);

          float n000 = hash(i + vec3(0.0, 0.0, 0.0));
          float n100 = hash(i + vec3(1.0, 0.0, 0.0));
          float n010 = hash(i + vec3(0.0, 1.0, 0.0));
          float n110 = hash(i + vec3(1.0, 1.0, 0.0));
          float n001 = hash(i + vec3(0.0, 0.0, 1.0));
          float n101 = hash(i + vec3(1.0, 0.0, 1.0));
          float n011 = hash(i + vec3(0.0, 1.0, 1.0));
          float n111 = hash(i + vec3(1.0, 1.0, 1.0));

          float nx00 = mix(n000, n100, u.x);
          float nx10 = mix(n010, n110, u.x);
          float nx01 = mix(n001, n101, u.x);
          float nx11 = mix(n011, n111, u.x);

          float nxy0 = mix(nx00, nx10, u.y);
          float nxy1 = mix(nx01, nx11, u.y);

          return mix(nxy0, nxy1, u.z);
        }

        float fbm(vec3 p) {
          float f = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 5; i++) {
            f += amp * noise(p);
            p *= 2.1;
            amp *= 0.52;
          }
          return f;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float t = uTime * 0.05;
          float n = fbm(dir * 2.4 + vec3(t * 0.7, t * 0.5, t * 0.9));
          float swirl = fbm(dir * 3.6 + vec3(t * -0.4, t * 0.3, t * 0.2));
          float mist = clamp(n * 0.6 + swirl * 0.4, 0.0, 1.0);
          float alpha = smoothstep(0.15, 0.7, mist) * 0.22;
          vec3 color = uBaseColor * (1.05 + mist * 0.7);
          gl_FragColor = vec4(color, alpha * uGlobalAlpha);
        }
      `,
    });
    material.toneMapped = false;
    return material;
  }

  private _enableFog(): void {
    const fog = new Fog(this._atmosphereColor.clone(), this._fogNear, this._fogFar);
    this._fogTarget.copy(this._atmosphereColor).lerp(this._fogDark, 0.35);
    fog.color.copy(this._fogTarget);
    this._scene.fog = fog;
    this._fogAlpha = 0;
  }

  private _updateGrid(elapsedTime: number): void {
    if (!this._active) return;

    if (this._startTime === null) {
      this._startTime = elapsedTime;
    }

    const elapsed = elapsedTime - this._startTime;
    for (let i = 0; i < this._segmentCount; i++) {
      const t = elapsed - this._delays[i];
      let alpha = 0;
      if (t > 0) {
        const flickerT = Math.min(Math.max(t / GRID_FLICKER_DURATION, 0), 1);
        const flicker =
          Math.max(0, Math.sin((t + this._jitters[i]) * 22)) * (1 - flickerT);
        const rampT = Math.min(
          Math.max((t - GRID_FLICKER_DURATION) / GRID_FADE_DURATION, 0),
          1
        );
        alpha = Math.min(1, flicker * 0.6 + rampT);
      }
      const v = i * 2;
      this._alphas[v] = alpha;
      this._alphas[v + 1] = alpha;
    }
    this._alphaAttr.needsUpdate = true;
  }

  private _updateAtmosphere(dt: number, elapsedTime: number): void {
    this._atmosphereAlpha = MathUtils.damp(
      this._atmosphereAlpha,
      this._active ? 1 : 0,
      2.4,
      dt
    );

    this._atmosphereMaterial.uniforms.uTime.value = elapsedTime;
    (this._atmosphereMaterial.uniforms.uBaseColor.value as Color).copy(
      this._atmosphereColor
    );
    this._atmosphereMaterial.uniforms.uGlobalAlpha.value = this._atmosphereAlpha;
  }

  private _updateFog(dt: number): void {
    const fog = this._scene.fog;
    if (!(fog instanceof Fog)) return;

    this._fogAlpha = MathUtils.damp(this._fogAlpha, this._active ? 1 : 0, 2.4, dt);
    this._fogTarget.copy(this._atmosphereColor).lerp(this._fogDark, 0.35);
    this._fogWork.copy(this._fogTarget).multiplyScalar(this._fogAlpha);
    fog.color.lerp(this._fogWork, 0.12);
  }
}

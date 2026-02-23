import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Camera,
  CanvasTexture,
  Color,
  type ColorRepresentation,
  Fog,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  Object3D,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from "three";

const BASE_ATMOS_COLOR = new Color(0.08, 0.22, 0.52);

const GRID_FLICKER_DURATION = 0.25;
const GRID_FADE_DURATION = 0.45;
const GRID_DELAY_SCALE = 0.08;
const GRID_JITTER = 0.12;

const GRID_RAY_THRESHOLD = 0.18;
const LABEL_OFFSET = new Vector3(0.075, 0.075, 0.075);
const LABEL_WORLD_HEIGHT = 0.085;
const LABEL_FONT = '26px "IBM Plex Mono", "Space Mono", monospace';

type LabelResource = {
  sprite: Sprite;
  material: SpriteMaterial;
  texture: CanvasTexture;
};

export interface GridHoverSnapshot {
  coord: { x: number; y: number; z: number };
  world: { x: number; y: number; z: number };
  label: string;
}

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
  private readonly _gridDistance: number;
  private readonly _lineLength: number;
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
  private readonly _raycaster = new Raycaster();
  private readonly _allCoordLabels = new Group();
  private readonly _selectedGeometry: BufferGeometry;
  private readonly _selectedMaterial: LineBasicMaterial;
  private readonly _selectedLines: LineSegments<
    BufferGeometry,
    LineBasicMaterial
  >;

  private _active = true;
  private _startTime: number | null = null;
  private _atmosphereAlpha = 0;
  private _fogAlpha = 0;
  private _showAllCoordinateLabels = false;
  private _allLabelsBuilt = false;
  private _allLabelResources: LabelResource[] = [];
  private _hoverLabel: LabelResource;
  private _hoverLabelText = "";
  private _hasHoverCoord = false;
  private _hoverCoord = new Vector3();
  private _hasSelectedCoord = false;
  private _selectedCoord = new Vector3();

  constructor(opts: AstralBackdropOptions) {
    this._scene = opts.scene;
    this._active = opts.active ?? true;
    this._gridDistance = Math.max(1, Math.floor(opts.gridDistance ?? 5));
    this._lineLength = opts.lineLength ?? 0.05;
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
      this._lineLength,
      this._gridDistance,
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

    this._allCoordLabels.visible = false;
    this._allCoordLabels.name = "astral-grid-coordinate-labels";
    this._gridLines.add(this._allCoordLabels);

    this._selectedGeometry = new BufferGeometry();
    this._selectedGeometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(18), 3)
    );
    this._selectedMaterial = new LineBasicMaterial({
      color: "#ffae00",
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
    });
    this._selectedMaterial.toneMapped = false;
    this._selectedLines = new LineSegments(
      this._selectedGeometry,
      this._selectedMaterial
    );
    this._selectedLines.visible = false;
    this._selectedLines.frustumCulled = false;
    this._selectedLines.renderOrder = 4600;
    this._selectedLines.name = "astral-grid-selected-point";
    this._gridLines.add(this._selectedLines);

    this._hoverLabel = this._createLabelSprite("(0, 0, 0)", 0.96);
    this._hoverLabel.sprite.visible = false;
    this._hoverLabel.sprite.name = "astral-grid-hover-label";
    this._gridLines.add(this._hoverLabel.sprite);

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

  setCoordinateLabelsEnabled(enabled: boolean): void {
    this._showAllCoordinateLabels = enabled;
    if (enabled && !this._allLabelsBuilt) {
      this._buildAllCoordinateLabels();
    }
    this._allCoordLabels.visible = enabled;
    this._refreshHoverLabel();
  }

  getCoordinateLabelsEnabled(): boolean {
    return this._showAllCoordinateLabels;
  }

  updatePointerRay(camera: Camera, ndcX: number, ndcY: number): void {
    this._raycaster.params.Line = this._raycaster.params.Line ?? {};
    (this._raycaster.params.Line as { threshold?: number }).threshold =
      GRID_RAY_THRESHOLD;

    this._raycaster.setFromCamera(_v2.set(ndcX, ndcY), camera);
    const hit = this._raycaster.intersectObject(this._gridLines, false)[0];
    if (!hit) {
      this.clearPointerHover();
      return;
    }

    const localHit = this._gridLines.worldToLocal(hit.point.clone());
    const gx = Math.round(localHit.x);
    const gy = Math.round(localHit.y);
    const gz = Math.round(localHit.z);

    if (
      Math.abs(gx) > this._gridDistance ||
      Math.abs(gy) > this._gridDistance ||
      Math.abs(gz) > this._gridDistance
    ) {
      this.clearPointerHover();
      return;
    }

    this._hoverCoord.set(gx, gy, gz);
    this._hasHoverCoord = true;
    this._refreshHoverLabel();
  }

  clearPointerHover(): void {
    this._hasHoverCoord = false;
    this._hoverLabel.sprite.visible = false;
  }

  getHoveredGridPoint(grounded = false): Vector3 | null {
    if (!this._hasHoverCoord) return null;
    _v3.copy(this._hoverCoord);
    if (grounded) _v3.y = 0;
    return this._gridLines.localToWorld(_v3.clone());
  }

  getHoveredGridSnapshot(grounded = false): GridHoverSnapshot | null {
    const world = this.getHoveredGridPoint(grounded);
    if (!world) return null;
    return {
      coord: {
        x: this._hoverCoord.x,
        y: grounded ? 0 : this._hoverCoord.y,
        z: this._hoverCoord.z,
      },
      world: { x: world.x, y: world.y, z: world.z },
      label: this._formatCoordLabel(
        this._hoverCoord.x,
        grounded ? 0 : this._hoverCoord.y,
        this._hoverCoord.z
      ),
    };
  }

  placeObjectAtHoveredPoint(target: Object3D, grounded = true): boolean {
    const point = this.getHoveredGridPoint(grounded);
    if (!point) return false;
    target.position.copy(point);
    return true;
  }

  toggleSelectedFromHover(grounded = true): "selected" | "cleared" | "none" {
    if (!this._hasHoverCoord) return "none";

    const sx = this._hoverCoord.x;
    const sy = grounded ? 0 : this._hoverCoord.y;
    const sz = this._hoverCoord.z;

    if (
      this._hasSelectedCoord &&
      this._selectedCoord.x === sx &&
      this._selectedCoord.y === sy &&
      this._selectedCoord.z === sz
    ) {
      this.clearSelectedPoint();
      return "cleared";
    }

    this._selectedCoord.set(sx, sy, sz);
    this._hasSelectedCoord = true;
    this._updateSelectedMarker();
    return "selected";
  }

  clearSelectedPoint(): void {
    this._hasSelectedCoord = false;
    this._selectedLines.visible = false;
  }

  getSelectedGridPoint(grounded = false): Vector3 | null {
    if (!this._hasSelectedCoord) return null;
    _v3.copy(this._selectedCoord);
    if (grounded) _v3.y = 0;
    return this._gridLines.localToWorld(_v3.clone());
  }

  getSelectedGridSnapshot(grounded = false): GridHoverSnapshot | null {
    const world = this.getSelectedGridPoint(grounded);
    if (!world) return null;
    return {
      coord: {
        x: this._selectedCoord.x,
        y: grounded ? 0 : this._selectedCoord.y,
        z: this._selectedCoord.z,
      },
      world: { x: world.x, y: world.y, z: world.z },
      label: this._formatCoordLabel(
        this._selectedCoord.x,
        grounded ? 0 : this._selectedCoord.y,
        this._selectedCoord.z
      ),
    };
  }

  placeObjectAtSelectedPoint(target: Object3D, grounded = true): boolean {
    const point = this.getSelectedGridPoint(grounded);
    if (!point) return false;
    target.position.copy(point);
    return true;
  }

  update(dt: number, elapsedTime: number): void {
    this._updateGrid(elapsedTime);
    this._updateAtmosphere(dt, elapsedTime);
    this._updateFog(dt);
  }

  dispose(): void {
    this._gridLines.removeFromParent();
    this._atmosphereMesh.removeFromParent();

    this._disposeLabelResource(this._hoverLabel);
    for (const res of this._allLabelResources) {
      this._disposeLabelResource(res);
    }
    this._allLabelResources.length = 0;

    this._gridGeometry.dispose();
    this._gridMaterial.dispose();
    this._selectedGeometry.dispose();
    this._selectedMaterial.dispose();
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

  private _updateSelectedMarker(): void {
    if (!this._hasSelectedCoord) {
      this._selectedLines.visible = false;
      return;
    }

    const half = this._lineLength * 0.5;
    const x = this._selectedCoord.x;
    const y = this._selectedCoord.y;
    const z = this._selectedCoord.z;

    const pos = this._selectedGeometry.getAttribute("position") as BufferAttribute;
    const arr = pos.array as Float32Array;

    arr[0] = x - half;
    arr[1] = y;
    arr[2] = z;
    arr[3] = x + half;
    arr[4] = y;
    arr[5] = z;

    arr[6] = x;
    arr[7] = y - half;
    arr[8] = z;
    arr[9] = x;
    arr[10] = y + half;
    arr[11] = z;

    arr[12] = x;
    arr[13] = y;
    arr[14] = z - half;
    arr[15] = x;
    arr[16] = y;
    arr[17] = z + half;

    pos.needsUpdate = true;
    this._selectedGeometry.computeBoundingSphere();
    this._selectedLines.visible = true;
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

  private _buildAllCoordinateLabels(): void {
    if (this._allLabelsBuilt) return;
    this._allLabelsBuilt = true;

    for (let x = -this._gridDistance; x <= this._gridDistance; x++) {
      for (let y = -this._gridDistance; y <= this._gridDistance; y++) {
        for (let z = -this._gridDistance; z <= this._gridDistance; z++) {
          const label = this._formatCoordLabel(x, y, z);
          const res = this._createLabelSprite(label, 0.58);
          res.sprite.position.set(
            x + LABEL_OFFSET.x,
            y + LABEL_OFFSET.y,
            z + LABEL_OFFSET.z
          );
          this._allCoordLabels.add(res.sprite);
          this._allLabelResources.push(res);
        }
      }
    }
  }

  private _refreshHoverLabel(): void {
    if (!this._hasHoverCoord || this._showAllCoordinateLabels) {
      this._hoverLabel.sprite.visible = false;
      return;
    }

    const label = this._formatCoordLabel(
      this._hoverCoord.x,
      this._hoverCoord.y,
      this._hoverCoord.z
    );
    if (label !== this._hoverLabelText) {
      const pos = this._hoverLabel.sprite.position.clone();
      this._hoverLabel.sprite.removeFromParent();
      this._disposeLabelResource(this._hoverLabel);

      this._hoverLabel = this._createLabelSprite(label, 0.96);
      this._hoverLabel.sprite.name = "astral-grid-hover-label";
      this._hoverLabel.sprite.position.copy(pos);
      this._gridLines.add(this._hoverLabel.sprite);
      this._hoverLabelText = label;
    }

    this._hoverLabel.sprite.position.set(
      this._hoverCoord.x + LABEL_OFFSET.x,
      this._hoverCoord.y + LABEL_OFFSET.y,
      this._hoverCoord.z + LABEL_OFFSET.z
    );
    this._hoverLabel.sprite.visible = true;
  }

  private _createLabelSprite(
    label: string,
    alpha: number
  ): LabelResource {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to create canvas 2d context for grid labels");
    }

    context.font = LABEL_FONT;
    const padX = 20;
    const textW = Math.ceil(context.measureText(label).width);
    canvas.width = Math.max(96, textW + padX * 2);
    canvas.height = 52;

    const drawCtx = canvas.getContext("2d");
    if (!drawCtx) {
      throw new Error("Unable to draw canvas 2d context for grid labels");
    }

    drawCtx.clearRect(0, 0, canvas.width, canvas.height);
    drawCtx.font = LABEL_FONT;
    drawCtx.textBaseline = "middle";
    drawCtx.lineJoin = "round";
    drawCtx.lineWidth = 8;
    drawCtx.strokeStyle = "rgba(5, 6, 7, 0.85)";
    drawCtx.strokeText(label, padX, canvas.height * 0.5);
    drawCtx.fillStyle = `rgba(196, 220, 255, ${alpha.toFixed(3)})`;
    drawCtx.fillText(label, padX, canvas.height * 0.5);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.generateMipmaps = false;

    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    material.toneMapped = false;

    const sprite = new Sprite(material);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(LABEL_WORLD_HEIGHT * aspect, LABEL_WORLD_HEIGHT, 1);
    sprite.center.set(0, 0.5);
    sprite.renderOrder = 5000;

    return { sprite, material, texture };
  }

  private _disposeLabelResource(res: LabelResource): void {
    res.sprite.removeFromParent();
    res.material.dispose();
    res.texture.dispose();
  }

  private _formatCoordLabel(x: number, y: number, z: number): string {
    return `(${x}, ${y}, ${z})`;
  }
}

const _v2 = new Vector2();
const _v3 = new Vector3();

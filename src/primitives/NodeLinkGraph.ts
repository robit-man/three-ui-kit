/**
 * NodeLinkGraph - lightweight deterministic node/link motif.
 */

import { CircleGeometry, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface NodeLinkGraphOptions {
  width?: number;
  height?: number;
  nodeCount?: number;
  nodeSize?: number;
  linkProbability?: number;
  linkThickness?: number;
  seed?: number;
  nodeColorKey?: string;
  linkColorKey?: string;
  id?: string;
}

interface NodePos {
  x: number;
  y: number;
}

interface LinkPair {
  a: number;
  b: number;
}

export class NodeLinkGraph extends UIElement {
  private _width: number;
  private _height: number;
  private _nodeCount: number;
  private _nodeSize: number;
  private _linkProbability: number;
  private _linkThickness: number;
  private _seed: number;
  private _nodeColorKey: string;
  private _linkColorKey: string;
  private _nodes: Mesh[] = [];
  private _links: Mesh[] = [];
  private _positions: NodePos[] = [];
  private _pairs: LinkPair[] = [];

  constructor(opts: NodeLinkGraphOptions = {}) {
    const width = opts.width ?? 120;
    const height = opts.height ?? 80;
    super({
      sizing: { width, height },
      id: opts.id,
    });

    this._width = width;
    this._height = height;
    this._nodeCount = Math.max(2, Math.round(opts.nodeCount ?? 9));
    this._nodeSize = opts.nodeSize ?? 2.2;
    this._linkProbability = Math.max(0, Math.min(1, opts.linkProbability ?? 0.32));
    this._linkThickness = opts.linkThickness ?? 0.8;
    this._seed = Math.round(opts.seed ?? 17);
    this._nodeColorKey = opts.nodeColorKey ?? "accentA";
    this._linkColorKey = opts.linkColorKey ?? "line1";

    this._buildGraph();
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;

    for (const node of this._nodes) {
      node.material = theme.createFlatMaterial(this._nodeColorKey);
    }
    for (const link of this._links) {
      link.material = theme.createFlatMaterial(this._linkColorKey);
    }

    return this;
  }

  protected onStateChange(state: VisualState): void {
    if (!this.theme) return;
    const mul = this.theme.stateMultiplier(state);

    for (const node of this._nodes) {
      const mat = node.material as ShaderMaterial & {
        uniforms?: { uStateMul?: { value: number } };
      };
      if (mat.uniforms?.uStateMul) mat.uniforms.uStateMul.value = mul;
    }
    for (const link of this._links) {
      const mat = link.material as ShaderMaterial & {
        uniforms?: { uStateMul?: { value: number } };
      };
      if (mat.uniforms?.uStateMul) mat.uniforms.uStateMul.value = mul;
    }
  }

  private _buildGraph(): void {
    const rand = this._makeRandom(this._seed);
    const padX = 8;
    const padY = 8;

    this._positions.length = 0;
    this._pairs.length = 0;

    for (let i = 0; i < this._nodeCount; i++) {
      this._positions.push({
        x: padX + rand() * (this._width - padX * 2),
        y: padY + rand() * (this._height - padY * 2),
      });
    }

    for (let a = 0; a < this._nodeCount; a++) {
      for (let b = a + 1; b < this._nodeCount; b++) {
        if (rand() <= this._linkProbability) {
          this._pairs.push({ a, b });
        }
      }
    }

    if (this._pairs.length === 0 && this._nodeCount > 1) {
      this._pairs.push({ a: 0, b: 1 });
    }

    const nodeGeo = new CircleGeometry(0.5, 10);
    for (let i = 0; i < this._nodeCount; i++) {
      const node = new Mesh(nodeGeo.clone());
      node.name = `node-link-node-${i}`;
      this._nodes.push(node);
      super.add(node);
    }

    const linkGeo = new PlaneGeometry(1, 1);
    for (let i = 0; i < this._pairs.length; i++) {
      const link = new Mesh(linkGeo.clone());
      link.name = `node-link-edge-${i}`;
      this._links.push(link);
      super.add(link);
    }
  }

  private _makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  private _syncGeometry(): void {
    const w = this.computedWidth > 0 ? this.computedWidth : this._width;
    const h = this.computedHeight > 0 ? this.computedHeight : this._height;
    const sx = w / this._width;
    const sy = h / this._height;

    for (let i = 0; i < this._nodes.length; i++) {
      const p = this._positions[i];
      const node = this._nodes[i];
      node.scale.set(this._nodeSize, this._nodeSize, 1);
      node.position.set(p.x * sx, -(p.y * sy), 0.01);
    }

    for (let i = 0; i < this._links.length; i++) {
      const pair = this._pairs[i];
      const a = this._positions[pair.a];
      const b = this._positions[pair.b];
      const ax = a.x * sx;
      const ay = -(a.y * sy);
      const bx = b.x * sx;
      const by = -(b.y * sy);

      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.max(1, Math.hypot(dx, dy));

      const link = this._links[i];
      link.scale.set(len, this._linkThickness, 1);
      link.position.set((ax + bx) * 0.5, (ay + by) * 0.5, 0);
      link.rotation.set(0, 0, Math.atan2(dy, dx));
    }
  }

  onUpdate(): void {
    this._syncGeometry();
  }
}

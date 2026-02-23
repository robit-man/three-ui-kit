/**
 * Submenu — nested menu that expands from a parent Menu item.
 * Positioned to the right of the parent by default.
 */

import { UIElement } from "../core/UIElement.js";
import { Menu, type MenuItem, type MenuOptions } from "./Menu.js";
import type { UITheme } from "../core/UITheme.js";
import { Vector3 } from "three";

export interface SubmenuOptions {
  items: MenuItem[];
  width?: number;
  /** Offset from parent element (UI units) */
  offsetX?: number;
  offsetY?: number;
  id?: string;
  onSelect?: (itemId: string) => void;
}

export class Submenu extends UIElement {
  private _menu: Menu;
  private _isOpen = false;
  private _offsetX: number;
  private _offsetY: number;

  constructor(opts: SubmenuOptions) {
    super({
      // Keep submenu out of normal parent flow; the internal menu still renders/hit-tests.
      sizing: { width: 0, height: 0 },
      id: opts.id,
    });

    this._offsetX = opts.offsetX ?? 4;
    this._offsetY = opts.offsetY ?? 0;

    this._menu = new Menu({
      items: opts.items,
      width: opts.width ?? 200,
      onSelect: opts.onSelect,
    });

    this.add(this._menu);
    this.visible = false;
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    this._menu.applyTheme(theme);
    return this;
  }

  open(parentElement?: UIElement): void {
    this._isOpen = true;
    this.visible = true;
    if (!parentElement) {
      this.position.set(this._offsetX, -this._offsetY, 0.01);
      return;
    }

    // Position relative to the selected parent row, but in this submenu's parent space.
    const localAnchor = new Vector3(
      parentElement.computedWidth + this._offsetX,
      -this._offsetY,
      0.01
    );
    parentElement.localToWorld(localAnchor);
    if (this.parent) {
      this.parent.worldToLocal(localAnchor);
    }
    this.position.copy(localAnchor);
  }

  close(): void {
    this._isOpen = false;
    this.visible = false;
  }

  toggle(parentElement?: UIElement): void {
    if (this._isOpen) this.close();
    else this.open(parentElement);
  }

  get isOpen(): boolean { return this._isOpen; }
}

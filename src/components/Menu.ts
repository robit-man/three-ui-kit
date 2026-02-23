/**
 * Menu - vertical list of interactive items with expand/collapse.
 * Each item is a panel row with left label and optional right arrow.
 */

import { UIElement } from "../core/UIElement.js";
import { Panel } from "../primitives/Panel.js";
import { TextBlock } from "../primitives/TextBlock.js";
import { Divider } from "../primitives/Divider.js";
import type { UITheme } from "../core/UITheme.js";

export interface MenuItem {
  id: string;
  label: string;
  /** Optional sub-items */
  children?: MenuItem[];
  disabled?: boolean;
}

export interface MenuOptions {
  items: MenuItem[];
  width?: number;
  itemHeight?: number;
  id?: string;
  onSelect?: (itemId: string) => void;
}

const SPACER_EPSILON = 0.25;

class MenuArrowSpacer extends UIElement {
  private _row: UIElement;
  private _label: TextBlock;
  private _arrow: TextBlock;
  private _rowPadding: number;

  constructor(opts: {
    row: UIElement;
    label: TextBlock;
    arrow: TextBlock;
    rowPadding: number;
  }) {
    super({ sizing: { width: 0, height: 1 } });
    this._row = opts.row;
    this._label = opts.label;
    this._arrow = opts.arrow;
    this._rowPadding = opts.rowPadding;
  }

  onUpdate(): void {
    const innerWidth = Math.max(0, this._row.computedWidth - this._rowPadding * 2);
    const desired = Math.max(
      0,
      innerWidth - this._label.computedWidth - this._arrow.computedWidth
    );
    const current = typeof this.sizing.width === "number" ? this.sizing.width : 0;

    if (Math.abs(current - desired) > SPACER_EPSILON) {
      this.sizing.width = desired;
      this.markDirty();
    }
  }
}

export class Menu extends UIElement {
  private _items: MenuItem[];
  private _itemHeight: number;
  private _menuWidth: number;
  private _onSelect?: (itemId: string) => void;
  private _selectedId?: string;
  private _itemElements: Map<string, Panel> = new Map();
  private _disabledIds: Set<string> = new Set();

  constructor(opts: MenuOptions) {
    super({
      sizing: {
        width: opts.width ?? 240,
        height: "auto",
      },
      layout: { type: "STACK_Y", gap: 0, padding: 4 },
      id: opts.id,
    });

    this._items = opts.items;
    this._itemHeight = opts.itemHeight ?? 32;
    this._menuWidth = opts.width ?? 240;
    this._onSelect = opts.onSelect;
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    this._buildItems(theme);
    return this;
  }

  get selectedId(): string | undefined {
    return this._selectedId;
  }

  getItemElement(itemId: string): UIElement | undefined {
    return this._itemElements.get(itemId);
  }

  private _buildItems(theme: UITheme): void {
    this.clear();
    this._itemElements.clear();
    this._disabledIds.clear();

    const rowWidth = this._menuWidth - 8;
    const rowPadding = 8;

    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      const hasChildren = Boolean(item.children && item.children.length > 0);

      const row = new Panel({
        width: rowWidth,
        height: this._itemHeight,
        interactive: !item.disabled,
        id: item.id,
        layout: { type: "STACK_X", gap: 0, padding: rowPadding, align: "center" },
        style: {
          fillColor: theme.tokens.bg1,
          fillAlpha: item.disabled ? 0.18 : 0.4,
          strokeColor: theme.tokens.line1,
          strokeAlpha: item.disabled ? 0.08 : 0.18,
          strokeWidth: 1,
          cornerRadius: 3,
        },
      });
      row.applyTheme(theme);

      const label = new TextBlock({
        text: item.label,
        variant: "body",
        colorKey: item.disabled ? "text1" : "text0",
        maxWidth: hasChildren
          ? rowWidth - rowPadding * 2 - 16
          : rowWidth - rowPadding * 2,
      });
      label.applyTheme(theme);
      row.add(label);

      if (hasChildren) {
        const arrow = new TextBlock({
          text: ">",
          variant: "label",
          colorKey: "text1",
          align: "right",
        });
        arrow.applyTheme(theme);

        const spacer = new MenuArrowSpacer({
          row,
          label,
          arrow,
          rowPadding,
        });
        row.add(spacer, arrow);
      }

      this.add(row);
      this._itemElements.set(item.id, row);

      if (!item.disabled) {
        row.on("click", () => {
          this._selectedId = item.id;
          this._onSelect?.(item.id);
          this._updateSelection();
        });
        row.on("pointerenter", () => {
          if (this._selectedId !== item.id) {
            row.setState("hover");
          }
        });
        row.on("pointerleave", () => {
          if (this._selectedId !== item.id) {
            row.setState("idle");
          }
        });
      } else {
        this._disabledIds.add(item.id);
        row.setState("disabled");
      }

      if (i < this._items.length - 1) {
        const div = new Divider({ length: this._menuWidth - 16 });
        div.applyTheme(theme);
        this.add(div);
      }
    }

    this.markDirty();
  }

  private _updateSelection(): void {
    for (const [id, panel] of this._itemElements) {
      if (this._disabledIds.has(id)) {
        panel.setState("disabled");
      } else if (id === this._selectedId) {
        panel.setState("active");
      } else {
        panel.setState("idle");
      }
    }
  }
}

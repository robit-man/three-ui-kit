# Sidebar Workflow Redesign Index

## Objective
Redesign the sidebar around explicit workflow boundaries so users can clearly move from:
1. editing individual components
2. assembling components into a grid
3. hydrating grid elements with data bindings
4. instantiating the built UI into scene space

The redesign should present these as first-class tabbed workspaces (Markov blankets), with consistent controls, predictable state transitions, and robust local persistence.

## Current State Review

### Boundary Map (Current)
- `Component authoring`: catalog + customizer
  - Markup: `catalog-panel` and `customizer-panel` in [index.html](../index.html:788), [index.html](../index.html:802)
  - Logic: [index.html](../index.html:3121), [index.html](../index.html:3202), [index.html](../index.html:3272)
- `Grid assembly`: editor + tuneables + schema preview
  - Markup: `editor-panel`, `editor-tuneables` in [index.html](../index.html:821), [index.html](../index.html:833)
  - Logic: [index.html](../index.html:2783), [index.html](../index.html:2946), [index.html](../index.html:2892)
- `Data hydration`: binding controls live inside tuneables (same panel as assembly)
  - Markup: binding controls in [index.html](../index.html:856)
  - Logic: [index.html](../index.html:2399), [index.html](../index.html:2576)
- `Scene deployment`: add/drag/attach built UI and runtime rehydrate
  - Logic: [index.html](../index.html:3937), [index.html](../index.html:4059), [index.html](../index.html:4098), [index.html](../index.html:4256)
- `Diagnostics and rollout safety`: debug panel + compatibility gating
  - Logic: [index.html](../index.html:1789), [index.html](../index.html:3354), [index.html](../index.html:4564)

### State and Persistence (Current)
- Global mutable state lives in one large script scope:
  - `profileStore` and editor/runtime globals in [index.html](../index.html:1387)
- Multiple localStorage contracts are spread across feature areas:
  - Keys in [index.html](../index.html:1080), [index.html](../index.html:1103), [index.html](../index.html:1112)
  - Profile load/save in [index.html](../index.html:2020), [index.html](../index.html:2048)
  - Profile import/export in [index.html](../index.html:3327), [index.html](../index.html:3354)
- Cross-boundary updates are manual function chains:
  - `persist -> sync output -> sync live scene` patterns repeated across handlers (for example [index.html](../index.html:2497), [index.html](../index.html:2568), [index.html](../index.html:4833))

### UX Gaps
- Boundaries are present in code but not clearly expressed in UI hierarchy.
- Assembly and hydration are co-located in one panel, so users do not see a staged flow.
- No persistent workflow context (active boundary, selected element focus, in-progress operation stack).
- State mutation and persistence are coupled in event handlers, making behavior hard to reason about and evolve.
- Diagnostic signal exists, but is mixed with hover debug output and not framed as lifecycle health for the four-stage flow.

## Proposed Redesign (Exhaustive)

### 1) Top-Level Workflow Tabs (Markov Blankets)
Create a fixed tab bar at sidebar top with explicit boundaries:
- `Components`
- `Assembly`
- `Hydration`
- `Scene`
- `Profiles` (cross-cutting persistence/version governance)

Each tab is a sealed workspace with:
- its own primary surface
- its own inspector/tuneables rail
- explicit ingress/egress actions to next/previous boundary
- deterministic save/restore hooks

### 2) Consistent Workspace Anatomy Across Tabs
Every tab follows the same visual and behavioral template:
- `Tab Header`: title + short purpose + primary action
- `Main Surface`: task canvas/list for that boundary
- `Inspector Surface`: tuneables for selected item/context
- `Boundary Footer`: transition actions (`Back`, `Validate`, `Continue to <next>`)

This removes one-off layouts and creates a professional, repeatable interaction model.

### 3) Boundary Transition Contract
Define explicit transition guards:
- `Components -> Assembly`: requires at least one valid element definition
- `Assembly -> Hydration`: requires valid grid schema
- `Hydration -> Scene`: requires binding validation pass
- `Scene -> Profiles`: optional save/export checkpoint

Transitions write boundary snapshots and validation status to a central workflow state.

### 4) State Management Refactor Across Layers
Refactor to a layered store model with pure reducers/selectors:
- `uiShellState`: active tab, sidebar width, expanded panes
- `catalogState`: registry, filters, selected entry, custom drafts
- `assemblyState`: grid cells, selection, drag state, generated schema
- `hydrationState`: binding rows, field catalog, formatter selection, validation
- `sceneState`: placement mode, hover target, instantiated roots, anchor info
- `profileState`: profiles, active profile id, migration notes, import/export status
- `runtimeDiagnosticsState`: telemetry + binding diagnostics snapshots

Introduce action/event pipeline:
- UI dispatches action
- reducer updates state
- effects layer handles persistence/runtime sync
- derived selectors feed render/update functions

### 5) LocalStorage Persistence as a Versioned Envelope
Replace scattered writes with one persisted envelope:
- `workflowEnvelope.v1` containing:
  - shell workspace state
  - current draft state per tab
  - profile store snapshot ref/version
  - migration metadata

Keep domain stores separately exportable, but orchestrate reads/writes through one persistence gateway.

### 6) Professional Visual Consistency
- Unified spacing/typography scale for tab header, cards, tuneables rows, and action zones.
- Consistent button semantics:
  - primary = progress workflow
  - secondary = mutate local boundary
  - destructive = delete/clear
- Consistent empty states and validation states in every tab.
- Cross-tab progress indicator (for example stepper: `1 Components`, `2 Assembly`, `3 Hydration`, `4 Scene`).

### 7) Diagnostics as First-Class Workflow Health
Move diagnostics framing from generic hover debug to workflow health:
- tab-level banner for migration or validation issues
- hydration health panel (field/provider/binding status)
- scene deployment health (instances, anchor target, placement status)
- profile compatibility health (version gates, applied migrations)

## New Workorders
- `WO-018-tabbed-markov-blanket-shell.md`
- `WO-019-consistent-workspace-surface-system.md`
- `WO-020-components-boundary-redesign.md`
- `WO-021-assembly-boundary-redesign.md`
- `WO-022-hydration-boundary-redesign.md`
- `WO-023-scene-boundary-redesign.md`
- `WO-024-state-layer-and-persistence-refactor.md`
- `WO-025-diagnostics-tests-and-rollout-governance.md`

## Archive Note
Previously completed workorders have been retired to:
- `workorders/.old/`

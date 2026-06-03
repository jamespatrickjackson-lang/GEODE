# UI States And Feedback

**Status:** active standalone editor feedback spec.

The editor should show what will happen before it mutates structure. Silent
approximate placement is not acceptable.

## Global States

| State | Surface | Required feedback |
| --- | --- | --- |
| Idle | Whole editor | Selected element, active mode, active tool, Library state. |
| Hover | Canvas/tree/library | Subtle hover outline or row highlight. |
| Selected | Canvas/tree/inspector | Selection outline, active tree row, populated inspector. |
| Dragging | Canvas | Drag preview, target outline, snap guides, insertion line where relevant. |
| Resizing | Canvas | Resize handles, live dimensions, optional snap guide. |
| Drawing | Canvas | Preview of new shape/line/container. |
| Library drag | Library/canvas | Thumbnail-backed cursor preview and placement feedback. |
| Rejected drop | Canvas/tree | Reject color/state and Behavior Log message. |
| Saved | Library/Behavior Log | Entry appears immediately with thumbnail. |
| Persisted | Editor | Reload restores state. |

## Placement Feedback

During drag, the editor should show:

- Candidate target outline.
- Green/accepted state for valid target.
- Red/rejected state for invalid target.
- Insertion line for before/after reorder.
- Active smart guide lines for snap.
- Drag preview for library entries.

The visual feedback should match the final committed action.

## Behavior Log

The Behavior Log is concise and user-facing. It should record meaningful editor
decisions, not every pointer event.

Accepted examples:

- `Moved Card`
- `Nested Text into Sidebar`
- `Reordered Page Row before Sub Master Row`
- `Inserted Layer Row from Library`
- `Snapped x to Sidebar content edge`
- `Applied Overlay Card style`

Rejected examples:

- `Cannot nest Icon inside Text`
- `Cannot drop parent into descendant`
- `Cannot distribute across different parents`
- `No compatible style values for selected Line`

## Selection Feedback

- Selected elements show a clear outline.
- Resize handles appear only when resize is valid.
- Locked elements show lock state and do not show editable handles.
- Hidden elements are omitted from snap/drop targets.
- The tree row for the selected element is active.
- The inspector title matches the selected element.

## Padding Feedback

- Selected containers show visible padding insets.
- Padding overlay updates immediately when inspector values change.
- New children placed inside a padded parent appear inside the content zone.
- Drop target previews use the content zone, not the outer border.

## Snap Feedback

- Only active snap lines are shown.
- Smart guides should distinguish x and y anchors clearly.
- Snap must not appear for hidden, locked, self, or descendant targets.
- When `Ctrl` or `Cmd` suppresses snap, smart guides should disappear or show
  snap-off state.

## Library Feedback

- Every entry needs a thumbnail or preview.
- Hover highlights the entry.
- Drag shows a preview.
- Click insert and drag insert both log the result.
- Preview scale changes should be visible immediately.

## Persistence Feedback

- Saved library entries appear immediately.
- Reload must not lose structure, parentage, order, style, padding, guides,
  zoom, background, or library state.
- Reset is explicit and should make clear that local editor state will be
  cleared.

## Acceptance

1. A user can see whether a drop will nest, reorder, move, or reject before
   releasing the pointer.
2. Accepted and rejected actions are logged clearly.
3. Padding, snap, and insertion feedback are visible.
4. Library previews are not name-only.
5. Feedback state matches the persisted result.

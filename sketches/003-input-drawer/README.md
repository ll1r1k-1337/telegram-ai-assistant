## Variant: Input Drawer

### Design stance
Suggestions slide up as a drawer expanding from the input area — feels like the input field grew to offer help, integrated into the existing flow.

### Key choices
- Layout: drawer pushes up from input bar, messages area shrinks to accommodate — no overlay
- Typography: 13px text + meta row with tone pill and word count
- Color: subtle blue dot pulsing indicator, left-border accent on hover
- Interaction: drawer expands with spring animation, action buttons (Ещё, Длиннее, Формальнее), notification badge on AI button when auto-suggestions ready

### Trade-offs
- Strong at: doesn't overlay chat, feels like part of the input flow, action buttons allow refining suggestions, notification badge for auto-trigger
- Weak at: pushes messages up (layout shift), slightly more complex DOM injection (expanding within input area)

### Best for
- Users who want suggestions integrated into their typing flow
- Power users who want refinement controls (formal/longer/regenerate)
- Auto-trigger workflow — badge notifies without interrupting

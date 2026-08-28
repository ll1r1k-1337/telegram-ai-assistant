## Variant: Floating Panel

### Design stance
A standalone floating card with rich suggestion cards, triggered via FAB button — most information density per suggestion.

### Key choices
- Layout: 340px floating panel anchored bottom-right, covers part of chat
- Typography: 13px suggestion text + 10px tone tags + 11px hotkey hints
- Color: gradient AI icon (blue→purple), distinct card with header/footer structure
- Interaction: FAB opens panel with spring animation, numbered suggestions, "regenerate" button, close via X or Esc

### Trade-offs
- Strong at: rich metadata per suggestion (tone label, numbering), clear visual hierarchy, regenerate action, room for longer texts
- Weak at: occludes chat messages, feels more "app-within-app" than native, extra step to dismiss

### Best for
- Users who want to compare and evaluate suggestions carefully
- Longer reply contexts where tone/style differences matter
- Less technical users who prefer visual UI over keyboard shortcuts

## Variant: Inline Chips

### Design stance
Suggestions appear as compact clickable chips directly above the input field — minimal, non-intrusive, feels like Telegram's own UI.

### Key choices
- Layout: horizontal wrap chips between messages and input, same width as message area
- Typography: 13px chip text, 11px label — smaller than messages, subordinate
- Color: muted blue-grey chips (#1c2b3a) with Telegram-blue hover accent
- Interaction: click chip → text inserts into input with brief highlight animation

### Trade-offs
- Strong at: minimal visual disruption, feels native, doesn't block message reading
- Weak at: limited space for long suggestions, chips truncate with ellipsis

### Best for
- Users who want subtle assistance without UI overhead
- Quick short replies (yes/no, confirmations, brief answers)
- Power users who prefer keyboard shortcuts (Alt+1/2/3)

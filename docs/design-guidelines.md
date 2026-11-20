# UI and accessibility

Use plain category names and the same three labels across the website, extension, and placeholders. **Show normally** leaves other rules in effect. **Hide** collapses a qualifying post. **Always show** protects a qualifying post even when another category would hide it. Describe the post’s content without judging its author.

| Surface | What the user needs |
| --- | --- |
| Website | A synthetic demo that works without an account or key. Identify sample content, let people reveal posts, and show the actual installation status for each browser. |
| Popup | Current filtering state, selected provider, hidden count, requests remaining, and a route to settings. Explain outages and limits. |
| Options | Put usable local rules and limits first. Preserve unsaved edits during refresh. Keep provider setup, consent, diagnostics, and confirmed data clearing reachable. |
| Hidden post | Keep a compact placeholder in the original position with the matched reason and a keyboard-operable reveal control. Restore focus on reveal. |

Keep pending posts visible and defer collapse while focus is inside the post. Use one polite announcement for a user action. Disabling filtering must restore host attributes, styles, and focusable content.

Use the [shared tokens](../packages/ui/src/tokens.ts) for light and dark themes, system typography, visible focus rings, and text labels for state. Aim for 44-pixel touch targets and support 200% zoom, reduced motion, and forced colors. Verify keyboard and screen-reader behavior with the [packaged accessibility protocol](../tests/accessibility/README.md).

# UI components

These files are **hand-written** in the shape of the [shadcn/ui](https://ui.shadcn.com) components for the
`base-nova` style, built on [Base UI](https://base-ui.com) (`@base-ui/react`) — not Radix. They were written by
hand because the shadcn registry wasn't reachable when the starter was created; the class names follow the
upstream "nova" style.

They are plain source files: edit them freely. To replace one with the upstream version (or add a new one), run
from `web/`:

```bash
pnpm dlx shadcn@latest add <name> --overwrite   # e.g. button, dialog, dropdown-menu (npx works too)
```

`components.json` is configured for that (style `base-nova`, aliases `@/components/ui`, `@/lib/utils`).
Keep app-specific components out of this folder: they belong in `src/components` or in a feature folder.

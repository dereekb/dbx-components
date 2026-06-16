# dbx-web Color System Migration Guide (v14)

This guide is for downstream apps migrating to the v14 color system refactor in `@dereekb/dbx-web`.

## What changed, conceptually

Before v14, the generated theme color classes and the `[dbxColor]` directive **painted** elements directly:

- `.dbx-primary-bg` (and every other `.dbx-{color}-bg` class) set the color CSS variables **and** applied `background:` + `color:` to the element.
- `[dbxColor]` applied those painting classes to its host.
- Components like `dbx-button`, `dbx-loading`, and `dbx-bar` exposed `color` inputs that forwarded a color down to whatever internal element actually painted.

In v14 the system splits **token providers** from **painters**:

| Class / API | Role in v14 | Changed? |
| --- | --- | --- |
| `.dbx-{color}` (e.g. `.dbx-warn`) | Themed text: sets `--dbx-color-current` **and** paints `color:` | Unchanged |
| `.dbx-{color}-bg` (e.g. `.dbx-primary-bg`) | **Token provider only**: sets `--dbx-color-current` (contrast) + `--dbx-bg-color-current` (color). Paints **nothing**. | **Breaking** |
| `.dbx-color-bg` | The painter: applies `background:` (tone-aware `color-mix`) + contrast `color:` from the current tokens | Unchanged behavior, now the *only* generic background painter |
| `.dbx-color-text` | Paints `color:` from `--dbx-color-current` | Unchanged |
| `[dbxColor]` | Token/marker provider only: applies the `.dbx-color` marker, the `.dbx-{color}-bg` var class (or inline token styles for a `DbxColorConfig`), and tonal state. **Never paints.** | **Breaking** |
| `[dbxTextColor]` | Unchanged (named colors resolve to `.dbx-{color}`, which still paints text) | Unchanged |

Painting now happens in exactly two ways:

1. **Explicit utility** — put `dbx-color-bg` (or `dbx-color-text`) on the element you want painted.
2. **Component-owned** — dbx components paint themselves from the inherited tokens, scoped on their own host carrying the `.dbx-color` marker (which `[dbxColor]` always applies). This is why you can now put `[dbxColor]` directly on `<dbx-loading>`, `<dbx-bar>`, `<dbx-icon-tile>`, `<dbx-progress-spinner-button>`, etc., and it "just works" — without painting the component's wrapper box.

`dbx-button` and `dbx-chip` are a special case: they **host** a `DbxColorDirective` themselves (via `hostDirectives`) and push their resolved color into it. Keep using their `color` inputs — and do **not** apply `[dbxColor]` to them (the directive would match the element twice and throw `NG0309`).

Because CSS custom properties inherit, the tokens flow down into the component's internals; because painting is scoped on the *directly-marked host*, a `[dbxColor]` on a page section does **not** accidentally repaint buttons, chips, or spinners inside it.

## Breaking changes

### 1. `.dbx-{color}-bg` classes no longer paint

Any element relying on a static `-bg` class for its background/text color renders unpainted until you add `dbx-color-bg`.

```html
<!-- before -->
<div class="dbx-primary-bg">Hero</div>

<!-- after -->
<div class="dbx-primary-bg dbx-color-bg">Hero</div>
```

This also applies to dynamically-built class names in TypeScript (e.g. `` `dbx-${color}-bg` ``) — append `dbx-color-bg` wherever the result is expected to paint.

### 2. `[dbxColor]` no longer paints plain elements

`[dbxColor]` on a generic element (a `div`, a `section`) only provides tokens now. Add `dbx-color-bg` to keep the painted background:

```html
<!-- before -->
<div dbxColor="accent">Painted panel</div>
<div [dbxColor]="{ color: '#ff0066', contrast: 'white' }">Custom panel</div>

<!-- after -->
<div dbxColor="accent" class="dbx-color-bg">Painted panel</div>
<div [dbxColor]="{ color: '#ff0066', contrast: 'white' }" class="dbx-color-bg">Custom panel</div>
```

`[dbxColor]` on dbx components (buttons, loading, bars, cards, chips, icon tiles) needs **no** extra class — those components paint themselves from the tokens.

Tonal mode (`[dbxColorTone]`, `config.tone` / `config.tonal`) works as before; on plain elements it requires the same `dbx-color-bg` pairing.

### 3. Removed color passthrough inputs

The following inputs were **removed**. Replace each with `[dbxColor]` (or static `dbxColor="..."`) on the same element — the components now react to the externally-applied tokens.

| Component / type | Removed API | Replacement |
| --- | --- | --- |
| `DbxProgressButtonConfig` (spinner/bar buttons) | `buttonColor` field | `[dbxColor]` on `<dbx-progress-spinner-button>` / `<dbx-progress-bar-button>` (or `color` on the wrapping `<dbx-button>`) |
| `DbxLoadingComponent` (`dbx-loading`) | `color` input | `[dbxColor]` on `<dbx-loading>` |
| `DbxBasicLoadingComponent` (`dbx-basic-loading`) | `color` input | `[dbxColor]` on `<dbx-basic-loading>` |
| `DbxLoadingProgressComponent` (`dbx-loading-progress`) | `color` input | `[dbxColor]` on `<dbx-loading-progress>` |
| `DbxBarDirective` (`dbx-bar`, `[dbxBar]`) | `color` input | `[dbxColor]` on the bar element |
| `DbxBarHeaderComponent` (`dbx-bar-header`) | `color` input | `[dbxColor]` on `<dbx-bar-header>` |
| `DbxPagebarComponent` (`dbx-pagebar`) | `color` input (`DbxBarColor`) | `[dbxColor]` on `<dbx-pagebar>` |
| `DbxSidenavPagebarComponent` / `DbxSidenavPageComponent` / `DbxSidenavComponent` | `color` inputs | `[dbxColor]` on the component element |

```html
<!-- before -->
<dbx-loading [color]="loadingColor" [context]="context"></dbx-loading>
<dbx-bar color="primary">...</dbx-bar>

<!-- after -->
<dbx-loading [dbxColor]="loadingColor" [context]="context"></dbx-loading>
<dbx-bar dbxColor="primary">...</dbx-bar>
```

**Not breaking — `color` inputs that remain:**

- `DbxButtonComponent` (`dbx-button`) keeps its `color` input. The button hosts a `DbxColorDirective` and pushes its resolved color (active echo > `color` input > `buttonStyle.color`) into it, so `color` accepts both `DbxThemeColor` strings and `DbxColorConfig` objects, and `DbxButtonEcho.color` continues to recolor the button while an echo displays. Do **not** apply `[dbxColor]` to `<dbx-button>` — it throws `NG0309` (duplicate directive).
- `DbxChipDirective` (`dbx-chip`) keeps its `color`, `display`, and `tone` inputs, hosting a `DbxColorDirective` the same way (the default tone-18 tonal text handling is preserved). Do **not** apply `[dbxColor]` to `<dbx-chip>`.
- `DbxStepBlockComponent` (`dbx-step-block`) keeps its `color` input (forwarded to the badge's icon tile).

Notes:

- `[dbxColor]` accepts everything the old inputs did (`DbxThemeColor` strings like `'primary' | 'accent' | 'warn' | 'notice' | 'ok' | 'success' | 'grey' | 'disabled' | 'default'`) plus `DbxColorConfig` objects for arbitrary CSS colors — so most migrations are a rename, not a rewrite.
- Not affected: `dbx-flag` / `dbx-flag-prompt` (Material `ThemePalette` mechanism) and `dbx-content-border` (theme-token mechanism) keep their existing inputs.

### 4. Default-color behavior changes

- `<dbx-loading>` no longer defaults to `'primary'`. With no `[dbxColor]`, spinners/progress bars use the Angular Material default indicator color. Add `dbxColor="primary"` where you depended on the old default.
- `dbxColorBackground(undefined)` still resolves to `dbx-default`, but since `-bg` classes no longer paint, an unset `[dbxColor]` no longer forces any background.

### 5. Deprecated: `.dbx-bar-primary` / `.dbx-bar-accent` / `.dbx-bar-warn`

These mat-toolbar token classes still exist for compatibility but are no longer applied by any input. Prefer `[dbxColor]` on the bar/pagebar. If your CSS targets these classes, plan to retarget `dbx-bar.dbx-color` / the dbx tokens.

## Migration steps

Run these from your app root and fix what they find:

```bash
# 1. Static -bg classes that expect to paint → append dbx-color-bg
grep -rnE 'dbx-(primary|secondary|tertiary|accent|warn|notice|ok|success|grey|disabled|default)-bg' src

# 2. Dynamically-built -bg class names in TS
grep -rnE "dbx-.*-bg|'-bg'|\`-bg" src --include='*.ts'

# 3. Removed color inputs on dbx components → rename to dbxColor
#    (dbx-button, dbx-chip, and dbx-step-block keep their color inputs — leave those alone)
grep -rnE '<dbx-(loading|basic-loading|loading-progress|bar|bar-header|pagebar|sidenav|sidenav-page|sidenav-pagebar)[^>]*\[?color\]?=' src
grep -rn 'buttonColor' src

# 3b. dbxColor mistakenly applied to dbx-button / dbx-chip → use their color input instead (NG0309 otherwise)
grep -rnE '<dbx-(button|chip)[^>]*dbxColor' src

# 4. [dbxColor] on plain elements that expect a painted background → add dbx-color-bg
grep -rn 'dbxColor' src --include='*.html' --include='*.ts'
```

For hit #4, judge each usage: if the host is a dbx component (button, loading, bar, card, chip, icon tile, …) leave it alone; if it's a plain element that visually relied on the painted background, add `class="dbx-color-bg"`.

### Styling your own components from the tokens

If your app has custom components that should respond to an external `[dbxColor]`, follow the same scoped pattern dbx-web uses — paint from the tokens, gated on your own host carrying the `.dbx-color` marker:

```scss
my-status-tile.dbx-color {
  // vibrant color: var(--dbx-bg-color-current)
  // contrast/text color: var(--dbx-color-current)
  // tone (percentage, when tonal): var(--dbx-color-bg-tone)
  background: color-mix(in srgb, var(--dbx-bg-color-current) var(--dbx-color-bg-tone, 100%), transparent);
  color: var(--dbx-color-current);
}
```

Scoping on `.dbx-color` (rather than painting from the bare variables) prevents your component from picking up tokens inherited from an ancestor surface it wasn't meant to react to.

## Verification checklist

After migrating, visually check (light and dark themes):

- Painted sections/heroes that used static `-bg` classes
- Buttons (including spinner/progress buttons mid-action and icon buttons)
- Loading indicators — both colored (`[dbxColor]`) and default
- Bars, pagebars, and sidenav page headers
- Chips (especially tonal chips) and icon tiles / step blocks
- Any custom CSS that targeted `.dbx-*-bg` selectors or the `.dbx-bar-*` classes

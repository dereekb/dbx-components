# ARIA Accessibility Audit — Tracking

## Phase 0: Infrastructure Setup
- [x] Install `vitest-axe` + `axe-core`
- [x] Create shared a11y test helper (`vitest.a11y.ts`)
- [x] Enable Angular ESLint a11y rules in `eslint.config.angular.mjs`

## Phase 1: Shared ARIA Utility Directives
- [x] Add `ariaLabel` input to `AbstractDbxButtonDirective` (dbx-core)
- [x] Wire `ariaLabel` through `DbxProgressButtonConfig` to progress button templates
- [x] Wire `ariaLabel` into `DbxIconButtonComponent` with icon fallback for icon-only buttons
- [x] Add `aria-hidden="true"` to decorative icons in icon-only buttons

## Phase 2a: dbx-web Loading/Error States (Chunk 1)
- [ ] `DbxBasicLoadingComponent` — `role="status"`, `aria-live="polite"`, `aria-busy`
- [ ] `DbxLoadingProgressComponent` — `role="progressbar"`, `aria-label`
- [ ] `DbxErrorComponent` — `role="alert"`, `aria-live="assertive"`
- [ ] a11y tests for loading/error components

## Phase 2b: dbx-web Buttons (Chunk 1)
- [ ] Audit all button components for `aria-label` on icon-only usage
- [ ] `DbxFileUploadButtonComponent` — `aria-label`
- [ ] a11y tests for button components

## Phase 2c: dbx-web Dialogs/Nav (Chunk 2)
- [ ] `DbxPopoverComponent` — `role="dialog"`, `aria-modal`, `cdkTrapFocus`
- [ ] Navbar — `ariaCurrentWhenActive` on router links
- [ ] Sidenav — ARIA landmarks
- [ ] a11y tests for dialog/nav components

## Phase 2d: dbx-web Layout (Chunk 2)
- [ ] Sections — `aria-labelledby` linking headers to content
- [ ] Lists — `role="list"` / feed pattern
- [ ] Decorative icon audit — `aria-hidden="true"`
- [ ] a11y tests for layout components

## Phase 3a: dbx-form Field Types (Chunk 3)
- [ ] Formly fields — `aria-invalid`, `aria-describedby`, `aria-required`
- [ ] Phone/datetime/array fields
- [ ] Searchable/autocomplete fields — combobox pattern
- [ ] a11y tests for form fields

## Phase 3b: dbx-form Wrappers + Quiz (Chunk 4)
- [ ] Toggle/expand wrappers — disclosure pattern (`aria-expanded`, `aria-controls`)
- [ ] Section wrappers
- [ ] Quiz components — radiogroup pattern
- [ ] a11y tests for wrappers/quiz

## Phase 4a: dbx-firebase Auth (Chunk 5)
- [ ] Auth login buttons — `aria-label="Sign in with {provider}"`
- [ ] Email form verification
- [ ] a11y tests for auth components

## Phase 4b: dbx-firebase Notifications (Chunk 5)
- [ ] Notification components — `aria-live`
- [ ] a11y tests for notification components

## Phase 5: Skill Creation
- [ ] Create `dbx__guide__aria-accessibility` skill

## Phase 6: Verification
- [ ] Full automated test pass
- [ ] Manual VoiceOver walkthrough

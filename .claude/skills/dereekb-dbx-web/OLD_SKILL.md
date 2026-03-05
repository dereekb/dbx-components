---
name: DBX Web
description: Overview of @dereekb/dbx-web - browser-specific Angular components package
---

# DBX Web (@dereekb/dbx-web)

This skill provides an overview of the `@dereekb/dbx-web` package, which contains browser-specific Angular components and utilities built on top of `@dereekb/dbx-core`.

## Overview

**@dereekb/dbx-web** is the web platform package of the DBX component ecosystem. It provides:

- **Browser-specific** Angular components for web applications
- **Material Design** integration with Angular Material
- **Rich UI components** for layout, forms, interactions, and more
-**Built on dbx-core** - Extends the foundational patterns from @dereekb/dbx-core
- **Production-ready** components for modern web applications

This package contains all the visual and interactive components needed to build feature-rich Angular web applications.

## Package Architecture

```
@dereekb/util (Pure TypeScript utilities)
    ↓
@dereekb/dbx-core (Platform-agnostic Angular utilities)
    ↓
@dereekb/dbx-web (Browser-specific components)
```

DBX Web builds upon DBX Core by providing:
- Visual components (layout, text, avatars)
- Form controls and interactions
- File upload/download/preview
- Responsive utilities
- Material theme integration

## Key Feature Areas

### Layout Components

> [!NOTE]
> **Comprehensive documentation available in dedicated skill!**
> 
> See the **DBX Web Layout Components** skill for full documentation on containers, sections, bars, flex system, two-column layouts, text components, and more.

**Quick Overview:**
- Container components (content width, padding, elevation)
- Section components (vertical organization)
- Bar components (horizontal layout)
- Two-column responsive layouts
- Flex grid system (6-column layouts)
- Text components (chips, labels, detail blocks)
- Avatar components

**Example:**
```html
<dbx-content-container grow="medium">
  <dbx-section header="Page Title" icon="home">
    <dbx-content-elevate>
      <p>Your content here</p>
    </dbx-content-elevate>
  </dbx-section>
</dbx-content-container>
```

### List Components

> [!NOTE]
> **Comprehensive documentation available in dedicated skill!**
> 
> See the **DBX Web List Components** skill for full documentation on infinite scroll lists, selection lists, grid views, list modifiers, and empty states.

**Quick Overview:**
- Infinite scroll lists with automatic loading
- Selection mode toggling (view/select)
- Grid layouts for card displays
- List item modifiers (anchors, selection, ripples)
- Empty state handling
- Title grouping

**Example:**
```html
<div style="height: 400px">
  <dbx-list-view [state$]="items$">
    <dbx-list-empty-content empty>
      <p>No items found</p>
    </dbx-list-empty-content>
  </dbx-list-view>
</div>
```

### Interaction

Form controls, selectors, date pickers, and user interaction components.

**Key Components:**
- **Date/Time Pickers** - Calendar and time selection
- **Form Fields** - Extended Material form controls
- **Selectors** - Multi-select, tag inputs, chip selectors
- **Rich Text** - Content editing components
- **Search** - Search input with debounce
- **Menu** - Context menus and dropdowns
- **Modals** - Dialog and popup utilities
- **Notifications** - Toast and snackbar wrappers

**Common Exports:**
- `DbxDateTimePickerModule` - Date/time selection
- `DbxFormModule` - Form utilities
- `DbxSearchModule` - Search components
- `DbxModalModule` - Modal dialogs

**Example:**
```html
<!-- Date picker -->
<dbx-date-time-picker [(ngModel)]="selectedDate"></dbx-date-time-picker>

<!-- Tag selector -->
<dbx-tag-selector [tags]="availableTags" [(selected)]="selectedTags">
</dbx-tag-selector>
```

### Router

Web-specific routing components and utilities built on dbx-core router.

**Key Features:**
- **Route Views** - UI-Router view components
- **Loading States** - Route transition loading
- **Breadcrumbs** - Navigation breadcrumbs
- **Menu Integration** - Router-aware menus
- **Anchor Components** - Styled navigation links

**Common Exports:**
- `DbxRouterModule` - Web router utilities
- `DbxRouterViewModule` - View components
- `DbxAnchorComponent` - Extended anchor styling

### Extension

File handling, upload, download, and preview components.

**Key Features:**
- **File Upload** - Drag-drop file upload with progress
- **File Download** - Download utilities and components
- **File Preview** - Image, PDF, video preview
- **File Selection** - File picker components
- **Copy/Paste** - Clipboard utilities

**Common Exports:**
- `DbxFileUploadModule` - Upload components
- `DbxFileDownloadModule` - Download utilities
- `DbxFilePreviewModule` - Preview components
- `DbxCopyModule` - Clipboard copy

**Example:**
```html
<!-- File upload -->
<dbx-file-upload 
  [accept]="'image/*'" 
  (filesSelected)="onFilesSelected($event)">
</dbx-file-upload>

<!-- File preview -->
<dbx-file-preview [file]="selectedFile"></dbx-file-preview>
```

### Action

Web-specific action components extending dbx-core actions.

**Key Features:**
- **Action Buttons** - Material buttons with action integration
- **Action Progress** - Visual progress indicators
- **Action Menus** - Dropdowns with actions
- **Confirmation Dialogs** - Action confirmation modals

**Common Exports:**
- `DbxActionButtonModule` - Action button components
- `DbxActionMenuModule` - Action menu components

### Button

Web button components with Material Design styling.

**Key Features:**
- **Styled Buttons** - Pre-configured Material buttons
- **Icon Buttons** - Icon-only and icon+text buttons
- **Button Groups** - Grouped button layouts
- **Loading Buttons** - Buttons with loading states
- **Button Spacers** - Consistent spacing

**Common Exports:**
- `DbxButtonModule` - Button components
- `DbxButtonSpacerComponent` - Spacing utility

### Error

Error handling and display components.

**Key Features:**
- **Error Display** - User-friendly error messages
- **Error Boundaries** - Catch and display errors
- **Retry Components** - Retry failed operations
- **Error Pages** - Full-page error displays

**Common Exports:**
- `DbxErrorModule` - Error components
- `DbxErrorDisplayComponent` - Error message display

### Loading

Loading indicators and skeleton screens.

**Key Features:**
- **Progress Bars** - Linear and circular progress
- **Skeletons** - Content loading placeholders
- **Loading Overlays** - Full-screen loading states
- **Spinners** - Material spinner wrappers

**Common Exports:**
- `DbxLoadingModule` - Loading components
- `DbxSkeletonModule` - Skeleton screens

**Example:**
```html
<dbx-loading [loading]="isLoading$ | async">
  <p>Content shown when not loading</p>
</dbx-loading>
```

### Screen

Responsive utilities and screen size detection.

**Key Features:**
- **Breakpoint Observers** - Reactive screen size detection
- **Responsive Directives** - Show/hide based on screen size
- **Media Queries** - Angular-friendly media query helpers

**Common Exports:**
- `DbxScreenModule` - Screen utilities
- `DbxScreenBreakpointService` - Breakpoint detection

### Style

Theming and color directive utilities.

**Key Features:**
- **Color Directives** - `dbxColor` for theming
- **Theme Utilities** - Dynamic theme application
- **CSS Helpers** - Utility classes and directives

**Common Exports:**
- `DbxColorDirective` - Color theming
- `DbxStyleModule` - Style utilities

**Example:**
```html
<div dbxColor="primary">Primary colored content</div>
<div dbxColor="warn">Warning colored content</div>
```

## Sub-Packages

DBX Web includes three specialized sub-packages:

### @dereekb/dbx-web/calendar

FullCalendar integration for Angular applications.

**Features:**
- Calendar display components
- Event management
- Date range selection
- Custom event rendering

**Import:**
```typescript
import { DbxCalendarModule } from '@dereekb/dbx-web/calendar';
```

### @dereekb/dbx-web/mapbox

Mapbox GL integration for interactive maps.

**Features:**
- Map display components
- Marker management
- Geocoding utilities
- Custom map controls

**Import:**
```typescript
import { DbxMapboxModule } from '@dereekb/dbx-web/mapbox';
```

### @dereekb/dbx-web/table

Advanced table components with sorting, filtering, and pagination.

**Features:**
- Data table components
- Column configuration
- Sorting and filtering
- Pagination
- Export utilities

**Import:**
```typescript
import { DbxTableModule } from '@dereekb/dbx-web/table';
```

## Common Patterns

### Responsive Layout

Combine layout components for responsive designs:

```html
<dbx-content-container grow=" medium">
  <dbx-two-column dbxTwoColumnContext [showRight]="showDetail$ | async">
    <dbx-two-block left>
      <dbx-list-view [state$]="items$"></dbx-list-view>
    </dbx-two-block>
    <div right>
      <ui-view></ui-view>
    </div>
  </dbx-two-column>
</dbx-content-container>
```

### Form with Validation

Use interaction components with reactive forms:

```html
<form [formGroup]="form">
  <dbx-date-time-picker 
    formControlName="date"
    [required]="true">
  </dbx-date-time-picker>
  
  <dbx-tag-selector
    formControlName="tags"
    [tags]="availableTags">
  </dbx-tag-selector>
  
  <button dbx-action-button [action]="saveAction" [value]="form.value">
    Save
  </button>
</form>
```

### File Upload Flow

Complete file upload with preview:

```html
<dbx-file-upload
  [accept]="'image/*,application/pdf'"
  [maxSize]="10485760"
  (filesSelected)="onFilesSelected($event)">
  <p>Drag files here or click to select</p>
</dbx-file-upload>

@if (selectedFiles.length > 0) {
  @for (file of selectedFiles; track file.name) {
    <dbx-file-preview [file]="file"></dbx-file-preview>
  }
}
```

### Theming Pattern

Apply consistent theming throughout app:

```typescript
// theme.service.ts
@Injectable()
export class ThemeService {
  readonly isDark$ = new BehaviorSubject(false);
  
  toggleTheme(): void {
    this.isDark$.next(!this.isDark$.value);
  }
}
```

```html
<div [dbxColor]="isDark ? 'background' : 'primary'">
  Themed content
</div>
```

## Best Practices

### Layout Organization

✅ **Do**: Use container components for consistent width
```html
<dbx-content-container grow="medium">
  <dbx-section header="Title">
    <!-- Content -->
  </dbx-section>
</dbx-content-container>
```

❌ **Don't**: Apply arbitrary widths without containers
```html
<div style="width: 800px"><!-- Inconsistent --></div>
```

### List Heights

✅ **Do**: Always set height on list containers
```html
<div style="height: 400px">
  <dbx-list-view [state$]="items$"></dbx-list-view>
</div>
```

❌ **Don't**: Use lists without height constraints
```html
<dbx-list-view [state$]="items$"></dbx-list-view> <!-- Won't scroll -->
```

### Form Controls

✅ **Do**: Use DBX form components for consistency
```html
<dbx-date-time-picker formControlName="date"></dbx-date-time-picker>
```

✅ **Do**: Integrate with action stores
```html
<button dbx-action-button [action]="saveAction">Save</button>
```

### File Handling

✅ **Do**: Set file size and type restrictions
```html
<dbx-file-upload 
  [accept]="'image/*'"
  [maxSize]="5242880">
</dbx-file-upload>
```

✅ **Do**: Provide upload progress feedback
```html
<dbx-file-upload (uploadProgress)="onProgress($event)">
</dbx-file-upload>
```

### Responsive Design

✅ **Do**: Use flex groups with breakpoints
```html
<div dbxFlexGroup breakpoint="tablet" [breakToColumn]="true">
  <div [dbxFlexSize]="2">Column 1</div>
  <div [dbxFlexSize]="4">Column 2</div>
</div>
```

✅ **Do**: Use two-column layouts for master-detail
```html
<dbx-two-column dbxTwoColumnContext [showRight]="showDetail">
  <!-- Auto-adapts to mobile -->
</dbx-two-column>
```

### Theming

✅ **Do**: Use `dbxColor` directive for dynamic colors
```html
<div dbxColor="primary">Themed content</div>
```

❌ **Don't**: Hardcode colors in CSS
```html
<div style="color: #3f51b5"><!-- Don't --></div>
```

## Module Imports

Import specific modules to reduce bundle size:

```typescript
import { DbxLayoutModule } from '@dereekb/dbx-web';
import { DbxInteractionModule } from '@dereekb/dbx-web';
import { DbxFileUploadModule } from '@dereekb/dbx-web';
```

For convenience, use feature modules:

```typescript
import { 
  DbxContentContainerDirective,
  DbxSectionComponent,
  DbxListViewComponent
} from '@dereekb/dbx-web';
```

## Related Skills

- **DBX Core** - Foundation package with platform-agnostic utilities
- **DBX Web Layout Components** - Comprehensive layout component documentation
- **DBX Web List Components** - Comprehensive list component documentation

## Integration with DBX Core

DBX Web extends DBX Core patterns:

| DBX Core | DBX Web |
|----------|---------|
| `DbxActionStore` | `dbx-action-button` component |
| `Anchor` type | `dbx-anchor` component with styling |
| `AbstractSubscriptionDirective` | Base for all web components |
| `DbxInjectionComponent` | Used in dynamic rendering |
| Router utilities | `DbxRouterModule` with views |

All DBX Core patterns (actions, routing, subscriptions) work seamlessly with DBX Web components.

## Getting Started

1. **Install dependencies:**
```bash
npm install @dereekb/dbx-core @dereekb/dbx-web
```

2. **Import required modules:**
```typescript
import { DbxCoreModule } from '@dereekb/dbx-core';
import { DbxWebModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    DbxCoreModule,
    DbxWebModule,
    // Feature modules as needed
  ]
})
export class AppModule {}
```

3. **Use components in templates:**
```html
<dbx-content-container>
  <dbx-section header="Welcome">
    <p>Start building with DBX Web!</p>
  </dbx-section>
</dbx-content-container>
```

## TypeScript Support

All components are fully typed. Import types as needed:

```typescript
import { 
  Anchor,
  DbxActionStore,
  DbxInjectionComponentConfig,
  DbxListConfig,
  NumberWithLimit,
  TextChip
} from '@dereekb/dbx-web';
```

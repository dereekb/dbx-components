---
name: DBX Web Layout Components
description: Comprehensive guide for using layout components from @dereekb/dbx-web package
---

# DBX Web Layout Components

This skill provides comprehensive documentation for the layout components available in the `@dereekb/dbx-web` package. These components are used throughout the `dbx-components` project to create responsive, consistent layouts in Angular applications.

## Overview

The layout components are organized into several categories based on their function:

- **Container Components**: Control content width, padding, elevation, and presentation
- **Layout Structure**: Organize content vertically and horizontally  
- **Flex System**: Responsive column-based grid system
- **Visual Components**: Avatars, flags, and other visual elements
- **Utility Components**: Bars, sections, and other structural elements
- **Text Components**: Text, chips, labels, and detail blocks
- **List Components**: See **DBX Web List Components** skill for comprehensive list documentation

## Component Reference

### Container Components

#### `dbx-content-container`

Responsive content wrapper that restricts max-width and handles padding.

**Inputs:**
- `grow`: `'small' | 'medium' | 'large' | 'wide' | 'full'` (default: `'wide'`) - Controls max-width
- `padding`: `'none' | 'min' | 'small' | 'normal'` (default: `'normal'`) - Controls padding on all sides
- `topPadding`: `'none' | 'min' | 'small' | 'normal'` (default: `'none'`) - Controls top padding separately

**Example:**
```html
<dbx-content-container grow="medium" padding="normal">
  <p>This content is limited to medium width with normal padding.</p>
</dbx-content-container>

<dbx-content-container grow="full" topPadding="small">
  <p>Full width container with small top padding.</p>
</dbx-content-container>
```

#### `dbx-content-border`

Adds a border around content.

**Inputs:**
- `color`: Material color name (`'primary' | 'accent' | 'warn'`, etc.)

**Example:**
```html
<dbx-content-border>
  <p>This content is bordered.</p>
</dbx-content-border>

<dbx-content-border color="primary">
  <p>This content is bordered with primary color.</p>
</dbx-content-border>
```

#### `dbx-content-box`

Wraps content in a box with box-sizing and optional elevation.

**Inputs:**
- `elevate`: `boolean` (default: `true`) - Whether to apply material elevation

**Example:**
```html
<dbx-content-box>
  <p>This content is in an elevated box.</p>
</dbx-content-box>

<dbx-content-box [elevate]="false">
  <p>This content is in a box without elevation.</p>
</dbx-content-box>
```

#### `dbx-content-elevate`

Applies material design elevation to content with padding.

**Inputs:**
- `elevate`: `boolean` (default: `true`) - Whether to apply elevation

**Example:**
```html
<dbx-content-elevate>
  <p>This content is elevated.</p>
</dbx-content-elevate>
```

#### `dbx-content-pit`

Container with background, margin, and internal label with space for content.

**Inputs:**
- `scrollable`: `boolean` - Limits height and makes content scrollable

**Example:**
```html
<dbx-content-pit>
  <p>This content is in a pit.</p>
</dbx-content-pit>

<dbx-content-pit [scrollable]="true">
  <p>This content is in a scrollable pit.</p>
  <!-- More content -->
</dbx-content-pit>

<!-- With label -->
<dbx-content-pit style="border-radius: 20px; width: 140px; height: 140px">
  <dbx-label-block header="Example Label">
    <div class="dbx-primary" style="text-align: center; font-size: 4.4em; font-weight: bold">100</div>
  </dbx-label-block>
</dbx-content-pit>
```

#### `dbx-content`

View/class that sets height to be the height of the page, minus top and content navigation bars. Used for full-height content areas.

**Example:**
```html
<dbx-content>
  <div style="background: grey; height: 100%"></div>
</dbx-content>
```

#### `.dbx-content-scroll-lock`

CSS class used with potentially infinitely scrollable content. Has fixed size and lets children scroll.

**Example:**
```html
<dbx-content>
  <div class="dbx-content-scroll-lock" style="background: grey">
    <div style="overflow: scroll; height: 100%">
      <div style="height: 5000px"></div>
    </div>
  </div>
</dbx-content>
```

#### `.dbx-content-end`

CSS class that adds margin to the bottom of a section.

**Example:**
```html
<dbx-content-border class="dbx-content-end" color="warn">
  <p>Content with bottom margin</p>
</dbx-content-border>
<p>Next section</p>
```

### Section Components

#### `dbx-section`

Component used to format content on a page within a section with header.

**Inputs:**
- `header`: `string` - Section header text
- `hint`: `string` - Hint text displayed below header
- `icon`: `string` - Material icon name
- `h`: `number` (default: `3`) - Heading level (1-6)
- `hintInline`: `boolean` (default: `false`) - Display hint inline with header
- `elevate`: `boolean` (default: `false`) - Apply elevation to section
- `paddedHeader`: `boolean` - Add padding to header

**Content Selectors:**
- `[sectionHeader]` - Custom navigation content in header area

**Example:**
```html
<dbx-section header="Header" hint="This is a section hint.">
  <span sectionHeader>Custom Navigation Span</span>
  <p>Section content here</p>
  <button mat-button mat-flat-button color="primary">Ok</button>
</dbx-section>

<dbx-section header="Elevated Section" icon="star" hint="Section with icon" [elevate]="true">
  <p>This section is configured with elevation and a star icon.</p>
</dbx-section>

<dbx-section header="Inline Hint" [h]="1" icon="star" hint="Inline hint text" [hintInline]="true" [elevate]="true">
  <p>Section with h1 and inline hint.</p>
</dbx-section>
```

#### `dbx-subsection`

Subsection with smaller header than `dbx-section`. Shares same inputs as `dbx-section`.

**Example:**
```html
<dbx-subsection header="Subsection Header" hint="This is the subsection hint.">
  <span sectionHeader>Custom Navigation</span>
  <p>Subsection content</p>
</dbx-subsection>

<dbx-section [paddedHeader]="true" header="Parent Section" icon="circle" hint="Section with subsection inside">
  <dbx-subsection header="Subsection Header" icon="circle" hint="Nested subsection" [elevate]="true">
    <p>Nested content</p>
  </dbx-subsection>
</dbx-section>
```

### Bar Components

#### `dbx-pagebar`

Bar component used for page navigation (top navbar).

**Content Selectors:**
- `[left]` - Content on left side
- `[right]` - Content on right side

**Example:**
```html
<dbx-pagebar>
  <button left mat-raised-button>Left</button>
  <div right>
    <button mat-raised-button>Right A</button>
    <dbx-button-spacer></dbx-button-spacer>
    <button mat-raised-button>Right B</button>
  </div>
</dbx-pagebar>
```

#### `dbx-bar`

Used to center and pad horizontal content (like buttons) using flex.

**Example:**
```html
<dbx-bar>
  <button mat-raised-button>A</button>
  <dbx-button-spacer></dbx-button-spacer>
  <button mat-raised-button>B</button>
  <dbx-button-spacer></dbx-button-spacer>
  <button mat-raised-button>C</button>
  <dbx-spacer></dbx-spacer>
  <button mat-raised-button>D</button>
</dbx-bar>
```

#### `dbx-bar-header`

Used to divide sections of vertical content with a labeled bar.

**Inputs:**
- `text`: `string` - Bar label text
- `icon`: `string` - Material icon name
- `color`: `string` - Color theme (`'primary' | 'accent' | 'warn' | 'disabled' | 'grey' | 'ok' | 'notice' | 'success'`)

**Example:**
```html
<dbx-content-border>
  <dbx-bar-header text="Bar Label" icon="home"></dbx-bar-header>
  <p>Content below the bar header</p>
</dbx-content-border>

<dbx-content-border>
  <dbx-bar-header text="Primary Bar" icon="home" color="primary"></dbx-bar-header>
  <p>Content with primary colored header</p>
</dbx-content-border>
```

### Two-Column Layout

#### `dbx-two-column`

Responsive two-column layout that shows one column full-width until the second column is enabled. On small screens, only one column is visible at a time.

**Inputs:**
- `showRight`: `boolean` - Whether to show right column (or managed by context)
- `hasRightContent`: `boolean` - Override to indicate right content exists
- `reverseSizing`: `boolean` (default: `false`) - Reverse sizing so left column grows
- `inSectionPage`: `boolean` (default: `false`) - Apply section page styling

**Directives:**
- `dbxTwoColumnContext` - Required directive to set up context
- `dbxTwoColumnFullLeft` - Extend left column to full width when `showRight` is false
- `dbxTwoColumnSref` - Configure backRef value for routing
- `dbxTwoColumnSrefShowRight` - Handle `showRight` value from routing

**Content Selectors:**
- `[left]` - Left column content
- `[right]` - Right column content
- `[top]` - Top content (within column)
- `[nav]` - Navigation content (within column)

**Related Components:**
- `dbx-two-block` - Use for left column content with header
- `dbx-two-column-head` - Header for columns
- `dbx-two-column-right` - Right column with built-in header

**Example:**
```html
<!-- Basic two column -->
<dbx-two-column dbxTwoColumnContext [showRight]="showRight" style="height: 400px">
  <dbx-two-block left>
    <dbx-two-column-head top>
      <span>Left Head</span>
    </dbx-two-column-head>
    <div style="height: 100%; background: red">
      <span>Left</span>
    </div>
  </dbx-two-block>
  <dbx-two-column-right right header="Right Side Header">
    <div nav>
      <button mat-icon-button><mat-icon>list</mat-icon></button>
    </div>
    <div style="height: 100%; background: blue">
      <span>Right</span>
    </div>
  </dbx-two-column-right>
</dbx-two-column>

<!-- With full-width left column -->
<dbx-two-column dbxTwoColumnContext [dbxTwoColumnFullLeft]="true" [showRight]="showRight" style="height: 200px">
  <dbx-two-block left><!-- content --></dbx-two-block>
  <dbx-two-column-right right header="Right Side"><!-- content --></dbx-two-column-right>
</dbx-two-column>

<!-- With routing integration -->
<dbx-two-column dbxTwoColumnContext [dbxTwoColumnSref]="twoRef" dbxTwoColumnSrefShowRight style="height: 200px">
  <dbx-two-block left>
    <dbx-anchor-list [anchors]="childAnchors"></dbx-anchor-list>
  </dbx-two-block>
  <ng-container right>
    <ui-view></ui-view>
  </ng-container>
</dbx-two-column>
```

### Flex Components

#### `dbxFlexGroup`

Creates a flexible column-based grid system. Divides content into 6 columns by default.

**Inputs:**
- `content`: `boolean` (default: `true`) - Apply flex group styling
- `breakpoint`: `'small' | 'tablet' | 'large' | 'full'` (default: `'tablet'`) - Width breakpoint where layout wraps
- `breakToColumn`: `boolean` (default: `false`) - Stack items vertically below breakpoint
- `relative`: `boolean` (default: `false`) - Use relative sizing between flex groups

**Example:**
```html
<!-- Basic 6-column layout -->
<div dbxFlexGroup class="text-center">
  <div class="dbx-warn-bg" [dbxFlexSize]="3">3</div>
  <div class="dbx-primary-bg" [dbxFlexSize]="1">1</div>
  <div class="dbx-accent-bg" [dbxFlexSize]="2">2</div>
</div>

<!-- With breakpoint -->
<div dbxFlexGroup breakpoint="small" class="text-center">
  <div class="dbx-warn-bg" [dbxFlexSize]="1">1</div>
  <div class="dbx-primary-bg" [dbxFlexSize]="1">1</div>
  <div class="dbx-accent-bg" [dbxFlexSize]="2">2</div>
  <div class="dbx-primary-bg" [dbxFlexSize]="1">1</div>
  <div class="dbx-warn-bg" [dbxFlexSize]="1">1</div>
</div>

<!-- With break to column -->
<div dbxFlexGroup breakpoint="tablet" [breakToColumn]="true" class="text-center">
  <div class="dbx-warn-bg" [dbxFlexSize]="1">1</div>
  <div class="dbx-primary-bg" [dbxFlexSize]="1">1</div>
  <div class="dbx-accent-bg" [dbxFlexSize]="2">2</div>
  <div class="dbx-warn-bg" [dbxFlexSize]="2">2</div>
</div>

<!-- Relative sizing -->
<div dbxFlexGroup [relative]="true" class="text-center">
  <div class="dbx-warn-bg" [dbxFlexSize]="3">3</div>
  <div class="dbx-primary-bg" [dbxFlexSize]="1">1</div>
</div>
```

#### `dbxFlexSize`

Sets the column size for an element within a `dbxFlexGroup`. Sizes are out of 6 columns total.

**Inputs:**
- `dbxFlexSize`: `1 | 2 | 3 | 4 | 5 | 6` (required) - Number of columns to occupy

**Example:**
```html
<div dbxFlexGroup>
  <div [dbxFlexSize]="2">Takes 2 columns</div>
  <div [dbxFlexSize]="4">Takes 4 columns</div>
</div>
```

### List Components

> [!NOTE]
> **List components have their own dedicated skill!**
> 
> For comprehensive documentation on list components including `dbx-list`, `dbx-selection-list-view`, `dbx-list-view`, `dbx-list-grid-view`, and all list item modifiers, please refer to the **DBX Web List Components** skill.

The DBX Web package includes powerful list components for:

- **Infinite scroll lists** with automatic loading
- **Selectable lists** with toggle modes
- **Grid layouts** for card-style displays  
- **List item modifiers** for anchors, selection, and customization
- **Empty states** and loading handling

**Quick Example:**
```html
<div style="height: 400px">
  <dbx-list-view [state$]="items$">
    <dbx-list-empty-content empty>
      <p>No items found</p>
    </dbx-list-empty-content>
  </dbx-list-view>
</div>
```

For detailed documentation, examples, and best practices, consult the **DBX Web List Components** skill.

### Text Components

Text components provide formatted text display, chips, labels, and detail blocks.

#### `dbx-linkify`

Automatically converts plaintext URLs into clickable links using the linkify library.

**Inputs:**
- `text`: `string` - Text to linkify

**Features:**
- Automatically adds `https://` protocol to URLs missing it
- Opens links in new tab by default
- Escapes HTML for security

**Example:**
```html
<dbx-linkify [text]="'Check out www.google.com and https://github.com'"></dbx-linkify>

<!-- With dynamic text -->
<dbx-linkify [text]="userBio"></dbx-linkify>
```

#### `dbx-text-chips`

Displays multiple chips in a Material chip listbox with optional tooltips.

**Inputs:**
- `chips`: `TextChip[]` - Array of chip configurations
- `defaultSelection`: `boolean` - Default selection state for chips

**Chip Interface:**
```typescript
interface TextChip {
  text: string;
  tooltip?: string;
  selected?: boolean;
  color?: 'primary' | 'accent' | 'warn';
  data?: T; // Optional custom data
}
```

**Example:**
```html
<dbx-text-chips [chips]="chips" [defaultSelection]="true"></dbx-text-chips>
```

```typescript
// In component:
chips: TextChip[] = [
  { text: 'Active', selected: true, color: 'primary' },
  { text: 'Pending', color: 'warn', tooltip: 'Awaiting approval' },
  { text: 'Completed', color: 'accent' }
];
```

#### `dbx-chip`

Lightweight chip directive with Material styling, smaller than mat-chip.

**Inputs:**
- `small`: `boolean` - Use small chip size
- `block`: `boolean` - Use block (square) corners instead of rounded
- `dbxColor`: DBX theme color - Color theme

**CSS Classes:**
- `.dbx-chip-spacer` - Adds spacing between chips
- `.dbx-chip-small-text` - Reduces text size in chip

**Example:**
```html
<!-- Standard chips with colors -->
<dbx-chip dbxColor="primary">Primary</dbx-chip>
<dbx-chip class="dbx-chip-spacer" dbxColor="accent">Accent</dbx-chip>
<dbx-chip class="dbx-chip-spacer" dbxColor="warn">Warn</dbx-chip>
<dbx-chip class="dbx-chip-spacer" dbxColor="success">Success</dbx-chip>

<!-- Small chips -->
<dbx-chip [small]="true" dbxColor="primary">Small</dbx-chip>

<!-- Block (square) chips -->
<dbx-chip [block]="true" [small]="true" dbxColor="primary">Block</dbx-chip>

<!-- In line with text -->
<p>
  <dbx-chip dbxColor="primary">Status</dbx-chip>
  <dbx-button-spacer></dbx-button-spacer>
  <span>Example Line Item</span>
</p>

<!-- Small text variant -->
<p>
  <dbx-chip class="dbx-chip-small-text" dbxColor="primary">Tag</dbx-chip>
  <dbx-button-spacer></dbx-button-spacer>
  <span>Item with small chip text</span>
</p>
```

#### `dbx-label-block`

Simple label with content block.

**Inputs:**
- `header`: `string` - Label text

**Example:**
```html
<dbx-label-block header="Email Address">
  user@example.com
</dbx-label-block>

<dbx-label-block header="Description">
  <p>Long form content here</p>
</dbx-label-block>
```

#### `dbx-detail-block`

Layout component with optional icon and header, content offset to the right. Useful for lists of details or settings.

**Inputs:**
- `icon`: `string` - Material icon name
- `header`: `string` - Block header text
- `alignHeader`: `boolean` (default: `false`) - Align custom header content to right
- `bigHeader`: `boolean` (default: `false`) - Use larger header text

**Content Selectors:**
- `[header]` - Custom header content (alternative to `header` input)

**Example:**
```html
<!-- Basic detail block -->
<dbx-detail-block icon="settings" header="Settings">
  <p>Configure your account settings here</p>
</dbx-detail-block>

<!-- With custom header content -->
<dbx-detail-block icon="phone">
  <dbx-anchor [anchor]="phoneAnchor" header>Call Support</dbx-anchor>
  <span>Available 24/7</span>
</dbx-detail-block>

<!-- With chip in header -->
<dbx-detail-block icon="mail">
  <span header>
    <dbx-chip [small]="true" dbxColor="primary">New</dbx-chip>
    Messages
  </span>
  <p>You have 5 unread messages</p>
</dbx-detail-block>

<!-- Big header variant -->
<dbx-detail-block icon="photo_size_select_large" [bigHeader]="true" header="Gallery">
  <p>Your photo gallery</p>
</dbx-detail-block>

<!-- Aligned header with number -->
<dbx-detail-block icon="attach_money" header="Cost" [alignHeader]="true">
  <dbx-number-with-limit header [number]="costLimit"></dbx-number-with-limit>
  <p>Monthly subscription cost</p>
</dbx-detail-block>

<!-- Without icon -->
<dbx-detail-block header="No Icon Example">
  <p>Content without an icon</p>
</dbx-detail-block>
```

#### `dbx-number-with-limit`

Displays a number with optional limit, automatically colored based on ratio.

**Inputs:**
- `number`: `NumberWithLimit` - Configuration object
- `rounded`: `boolean` - Use rounded corners

**NumberWithLimit Interface:**
```typescript
interface NumberWithLimit {
  value: number;           // Number to display
  limit?: number;          // Optional limit
  formatNumber?: (n: number) => string;  // Format function
  prefix?: string;         // Text before number
  suffix?: string;         // Text after number
}
```

**Color Logic:**
- `warn` - Value exceeds limit
- `notice` - Value equals limit or 80-100% of limit
- `ok` - Value is less than 80% of limit

**Example:**
```html
<!-- Basic number with limit -->
<dbx-number-with-limit [number]="{ value: 5, limit: 10 }"></dbx-number-with-limit>

<!-- With prefix and suffix -->
<dbx-number-with-limit 
  [number]="{ value: 250, limit: 500, prefix: '$', suffix: ' USD' }">
</dbx-number-with-limit>

<!-- Rounded variant -->
<dbx-number-with-limit 
  [number]="costConfig" 
  [rounded]="true">
</dbx-number-with-limit>

<!-- With format function -->
<dbx-number-with-limit [number]="formattedNumber"></dbx-number-with-limit>
```

```typescript
// In component:
costConfig: NumberWithLimit = {
  value: 1250.50,
  limit: 2000,
  prefix: '$',
  formatNumber: (n) => n.toFixed(2)
};
```

#### `dbx-us-address`

Formats a United States address with proper line breaks.

**Inputs:**
- `address`: `UnitedStatesAddressWithContent` - Address object

**CSS Class Alternative:**
- `.dbx-us-address` - Can be used on element containing formatted address string

**Example:**
```html
<!-- Component -->
<dbx-label-block header="Shipping Address">
  <dbx-us-address [address]="shippingAddress"></dbx-us-address>
</dbx-label-block>

<!-- CSS class -->
<p class="dbx-us-address">{{ addressString }}</p>
```

```typescript
// In component:
import { unitedStatesAddressString } from '@dereekb/util';

addressString = unitedStatesAddressString(address);
```

### Text CSS Classes

The following CSS utility classes are available for text styling:

#### Text Styles

- `.dbx-hint` - Hint text with reduced opacity (0.8)
- `.dbx-label` - Label text (caption size, 0.54 opacity)
- `.dbx-sublabel` - Sublabel text (same as label)
- `.dbx-note` - Note text with reduced opacity (0.7)
- `.dbx-form-description` - Form description text (75% size)
- `.dbx-small` / `.dbx-clear-hint` - Small text (0.8em)
- `.dbx-faint` - Faint text (0.54 opacity)
- `.dbx-u` - Underlined text
- `.text-left` - Left-aligned text
- `.text-center` / `.dbx-text-center` - Center-aligned text
- `.dbx-nowrap` - Prevent text wrapping
- `.dbx-outlined-text` - Text with outline/shadow
- `.dbx-text-no-overflow` - Show all text, no truncation
- `.dbx-modelkey` - Line-break anywhere (for long keys/IDs)

**Example:**
```html
<p class="dbx-hint">This is a hint</p>
<p class="dbx-label">Form Label</p>
<p class="dbx-note">Additional note</p>
<p class="dbx-form-description">Field description text</p>
<p class="dbx-u">Underlined text</p>
<p class="text-center">Centered text</p>
<p class="dbx-nowrap">Text that won't wrap to next line</p>
```

#### Color CSS Classes

Text and background color classes for theming:

- `.dbx-primary` / `.dbx-primary-bg` - Primary theme color
- `.dbx-accent` / `.dbx-accent-bg` - Accent theme color
- `.dbx-warn` / `.dbx-warn-bg` - Warning color (red)
- `.dbx-notice` / `.dbx-notice-bg` - Notice color (orange/yellow)
- `.dbx-ok` / `.dbx-ok-bg` - OK/safe color (blue)
- `.dbx-success` / `.dbx-success-bg` - Success color (green)
- `.dbx-grey` / `.dbx-grey-bg` - Grey color
- `.dbx-disabled` / `.dbx-disabled-bg` - Disabled color
- `.dbx-bg` - Background color

**Example:**
```html
<!-- Text colors -->
<p class="dbx-primary">Primary colored text</p>
<p class="dbx-warn">Warning text</p>
<p class="dbx-success">Success message</p>

<!-- Background colors -->
<p class="dbx-primary-bg">Primary background</p>
<p class="dbx-warn-bg">Warning background</p>
<p class="dbx-success-bg">Success background</p>

<!-- Combined with other elements -->
<div class="dbx-flex-group">
  <div class="dbx-warn-bg" [dbxFlexSize]="2">Warning Section</div>
  <div class="dbx-success-bg" [dbxFlexSize]="2">Success Section</div>
</div>
```

#### Helper Classes

- `.dbx-label-padded` - Adds bottom padding (6px) to labels
- `.dbx-icon-spacer` - Adds right margin for icon spacing
- `.dbx-chip-spacer` - Adds right margin between chips
- `.dbx-chip-small-text` - Reduces chip text size to 10px
- `.dbx-chip-margin` - Adds 4px margin around chip

**Example:**
```html
<span class="dbx-label dbx-label-padded">Label with padding</span>

<mat-icon class="dbx-icon-spacer">home</mat-icon>
<span>Text next to icon</span>

<dbx-chip class="dbx-chip-spacer" dbxColor="primary">Chip 1</dbx-chip>
<dbx-chip class="dbx-chip-spacer" dbxColor="accent">Chip 2</dbx-chip>
```



#### `dbx-avatar`

Displays user avatars with various styles and sizes.

**Inputs:**
- `context`: `DbxAvatarContext` - Avatar context object
- `avatarSelector`: Selector for avatar
- `avatarUid`: User identifier  
- `avatarUrl`: Image URL
- `avatarKey`: Avatar key
- `avatarIcon`: Material icon name (fallback)
- `avatarStyle`: `'circle' | 'square'` - Avatar shape
- `avatarSize`: `'small' | 'normal' | 'large'` - Avatar size
- `avatarHideOnError`: `boolean` - Hide avatar if image fails to load

**CSS Classes:**
- `.dbx-avatar-small` - Small avatar size
- `.dbx-avatar-large` - Large avatar size

**Example:**
```html
<!-- Default avatar with icon -->
<dbx-avatar></dbx-avatar>
<dbx-avatar avatarStyle="square"></dbx-avatar>

<!-- Sized avatars -->
<dbx-avatar avatarSize="small"></dbx-avatar>
<dbx-avatar avatarSize="small" avatarStyle="square"></dbx-avatar>
<dbx-avatar avatarSize="large"></dbx-avatar>
<dbx-avatar avatarSize="large" avatarStyle="square"></dbx-avatar>

<!-- Avatar with URL -->
<dbx-avatar [avatarUrl]="demoAvatarUrl"></dbx-avatar>
<dbx-avatar [avatarUrl]="demoAvatarUrl" avatarStyle="square"></dbx-avatar>

<!-- Custom icon -->
<dbx-avatar avatarIcon="admin_panel_settings" avatarSize="small"></dbx-avatar>
<dbx-avatar avatarIcon="admin_panel_settings" avatarStyle="square"></dbx-avatar>

<!-- With broken URL (shows fallback icon) -->
<dbx-avatar [avatarUrl]="demoBrokenAvatarUrl"></dbx-avatar>
<dbx-avatar [avatarUrl]="demoBrokenAvatarUrl" avatarIcon="cancel"></dbx-avatar>
```

## Common Patterns

### Responsive Content Layout

```html
<dbx-content-container grow="medium">
  <dbx-section header="Page Title" hint="Page description" icon="home">
    <dbx-content-elevate>
      <p>Main content here</p>
    </dbx-content-elevate>
  </dbx-section>
</dbx-content-container>
```

### Master-Detail Layout

```html
<dbx-two-column dbxTwoColumnContext [showRight]="showDetail" style="height: 100vh">
  <dbx-two-block left>
    <dbx-two-column-head top>
      <span>Items</span>
    </dbx-two-column-head>
    <dbx-list [state$]="items$" [config]="listConfig"></dbx-list>
  </dbx-two-block>
  <dbx-two-column-right right header="Details">
    <!-- Detail view content -->
  </dbx-two-column-right>
</dbx-two-column>
```

### Flex Grid with Cards

```html
<div dbxFlexGroup breakpoint="tablet" [breakToColumn]="true">
  <div [dbxFlexSize]="2">
    <dbx-content-box>
      <h3>Card 1</h3>
      <p>Content</p>
    </dbx-content-box>
  </div>
  <div [dbxFlexSize]="2">
    <dbx-content-box>
      <h3>Card 2</h3>
      <p>Content</p>
    </dbx-content-box>
  </div>
  <div [dbxFlexSize]="2">
    <dbx-content-box>
      <h3>Card 3</h3>
      <p>Content</p>
    </dbx-content-box>
  </div>
</div>
```

### Selectable List with Actions

```html
<div style="height: 400px">
  <dbx-selection-list-view 
    [selectionMode]="selectionMode$ | async" 
    [state$]="items$"
    (selectionChange)="onSelectionChange($event)">
    <div top>
      <dbx-bar>
        <button mat-button (click)="toggleSelectionMode()">
          {{ (selectionMode$ | async) === 'select' ? 'View' : 'Select' }}
        </button>
        <dbx-spacer></dbx-spacer>
        <button mat-button color="primary" (click)="doAction()">Action</button>
      </dbx-bar>
    </div>
    <button bottom mat-raised-button (click)="loadMore()">Load More</button>
  </dbx-selection-list-view>
</div>
```

## Best Practices

### Height Management

- List components like `dbx-list` require a set height to function properly
- Use `dbx-content` for full-page height management
- Set explicit `height` or `style="height: XXXpx"` on list container elements

### Content Width

- Use `dbx-content-container` for consistent content width across the app
- `grow="wide"` is the default and works well for most content
- `grow="medium"` for narrower content like forms
- `grow="full"` when you need to use the entire width

### Elevation

- Use `dbx-content-elevate` or `elevate` inputs to lift important content
- Don't over-use elevation - it loses impact
- Typically use elevation for cards, dialogs, and important sections

### Lists

For comprehensive list best practices, see the **DBX Web List Components** skill. Key points:

- Lists require a set height to function properly
- Always provide a `state$` observable with `ListLoadingState`
- Handle empty states with `dbx-list-empty-content`
- Choose appropriate list type (selection vs view vs grid)

### Responsive Design

- Use `dbxFlexGroup` with `breakpoint` and `breakToColumn` for responsive layouts
- Two-column layouts automatically adapt to mobile screens
- Test layouts on different screen sizes

### Accessibility

- Provide meaningful `header` and `hint` text for sections
- Use proper heading levels with the `h` input
- Ensure list items have proper anchor values for keyboard navigation

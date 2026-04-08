# Forge Demo Parity — Inconsistencies Between ngx-formly and ng-forge

Audit of all `localhost:9010/doc/form/*` pages comparing the left (ngx-formly) and right (ng-forge) demo implementations.

## Summary

- **34 total inconsistencies** found across 7 pages
- **3 bugs** (fields visible when they should be hidden, date value not rendering)
- **7 missing sections** (entire field type demos absent from forge)
- **8 missing fields** (individual fields absent from a section that otherwise exists)
- **4 output mismatches** (JSON output differs between formly and forge)
- **4 missing description text** items
- **3 styling/layout issues**
- Other minor issues (label naming, required asterisks, presentation differences)

## Inconsistencies

| # | Page | Section | Issue | Severity |
|---|------|---------|-------|----------|
| 1 | `/doc/form/date` | dateTimeField() - Day Only W/ String Value | Forge date input is visually empty (clear button present but no date text); formly shows "04/19/2026" | Bug |
| 2 | `/doc/form/date` | dateTimeField() - Time For Today (For Timezone) | Forge missing description: "This date field is configured to not show the clear button. This field is also configured to hide the date field when the selectable date is only a single day." | Missing text |
| 3 | `/doc/form/date` | dateTimeField() - Timezone Day | Forge missing description: "A minimum of today and a maximum of 14 days from now." | Missing text |
| 4 | `/doc/form/date` | dateTimeField() - all sub-headers | Forge sub-headers render **bold**; formly renders plain text | Styling |
| 5 | `/doc/form/date` | fixedDateRangeField() | Forge shows only 1 date range field; formly shows 4 (Fixed, One Month Arbitrary, One Month Normal, Max Calendar Month) | Missing fields |
| 6 | `/doc/form/date` | fixedDateRangeField() | Forge uses compact date range input; formly uses inline calendar pickers | Different presentation |
| 7 | `/doc/form/date` | fixedDateRangeField() | Forge description omits "Returns the date as an ISO8601DateString." | Missing text |
| 8 | `/doc/form/date` | fixedDateRangeField() | Forge JSON output is `{}` while formly has actual range values | Empty output |
| 9 | `/doc/form/date` | dateRangeField() | Forge shows only one Start/End pair; formly shows two (second has M/T start, W/T/F end constraints) | Missing fields |
| 10 | `/doc/form/date` | dateRangeField() | Forge Start/End fields missing "CDT" timezone suffix | Missing timezone |
| 11 | `/doc/form/date` | dateTimeRangeField() | Entire section missing from forge (6 time range pairs, formly only) | Missing section |
| 12 | `/doc/form/date` | timeDurationField() - TimeDurationData output | Formly shows placeholder "e.g. 2h30m" (empty); forge shows "0s" (default value) | Value mismatch |
| 13 | `/doc/form/value` | phoneField() | JSON output: formly `{ "section": {} }`, forge `{}` | Output mismatch |
| 14 | `/doc/form/value` | textField() - Text Field | Formly shows "Text Field *" (required asterisk); forge shows "Text Field" without asterisk | Missing required |
| 15 | `/doc/form/value` | textField() - Transformed Text Field | Forge missing description: "Adds _ between each letter as you type." | Missing text |
| 16 | `/doc/form/value` | numberField() / dollarAmountField() | Formly JSON `{}`; forge JSON `{ "test": null, "steptest": null, ... }` (null values not stripped) | Output mismatch |
| 17 | `/doc/form/value` | numberSliderField() | Forge labels say "forgeNumberSliderField()" — "forge" prefix leaks into UI labels | Label naming |
| 18 | `/doc/form/value` | textAreaField() | Formly shows "Text Area Field *" (required); forge shows "Text Area Field" without asterisk | Missing required |
| 19 | `/doc/form/value` | latLngTextField() | Entire section missing from forge | Missing section |
| 20 | `/doc/form/value` | toggleField() - styledBox: false | Variant missing from forge | Missing section |
| 21 | `/doc/form/value` | repeatArrayField() | Entire section missing from forge (also build error: `repeatArrayField` not found) | Missing section |
| 22 | `/doc/form/value` | addressField() | Entire section missing from forge | Missing section |
| 23 | `/doc/form/selection` | valueSelectionField() - Select One With Clear | Field missing from forge | Missing field |
| 24 | `/doc/form/selection` | valueSelectionField() - Select Native | Field missing from forge | Missing field |
| 25 | `/doc/form/selection` | sourceSelectField() - Select With Source Button | Field missing from forge | Missing field |
| 26 | `/doc/form/selection` | sourceSelectField() - Select Many (Filterable) | Field missing from forge | Missing field |
| 27 | `/doc/form/selection` | pickableItemChipField() | Entire section (8 chip picker variants) missing from forge | Missing section |
| 28 | `/doc/form/expression` | Hide Example | Forge shows "Name", "Text", "Text Area" fields that should be hidden when toggle is off; formly correctly hides them | Bug |
| 29 | `/doc/form/texteditor` | textEditorField() | JSON output: formly `{ "editor": "" }`, forge `{}` | Output mismatch |
| 30 | `/doc/form/wrapper` | expandWrapper() | Forge missing "Add Name" expandable trigger link | Missing field |
| 31 | `/doc/form/wrapper` | toggleWrapper() | Forge shows "Name" field despite toggle being off; formly correctly hides it | Bug |
| 32 | `/doc/form/wrapper` | styleWrapper() | Different styles: formly has dashed blue border, forge has pink/red background | Styling mismatch |
| 33 | `/doc/form/wrapper` | flexLayoutWrapper() - 5 Per Row | Forge renders fields as tiny squished boxes without labels | Layout bug |
| 34 | `/doc/form/template` | usernamePasswordLoginFields() | Required asterisk spacing: formly "Email Address *" vs forge "Email Address*" | Minor styling |

## Pages With No Issues

- `/doc/form/form` — No formly/forge split; shared components only
- `/doc/form/component` — Both sides render identically

## Notes

- The value fields page (`/doc/form/value`) currently has a build error: `TS2304: Cannot find name 'repeatArrayField'` in `value.component.ts:238:4`, which prevents the bottom of the page from rendering.
- Items #19–22 (latLngTextField, toggleField styledBox:false, repeatArrayField, addressField) may be intentionally deferred if forge equivalents don't exist yet.
- Items #5, #9, #11, #27 (fixedDateRangeField variants, dateRangeField second pair, dateTimeRangeField, pickableItemChipField) are likely not yet implemented in forge.
- Items #28 and #31 (hide/toggle expression bugs) suggest forge's expression/hide system may not be fully wired up.

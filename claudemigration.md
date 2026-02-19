# Zoho API Factory Function Prefixing Refactoring Plan

## Context

The Zoho CRM and Recruit libraries have factory functions with inconsistent naming that's causing collisions. Currently:
- **CRM**: Only 5 tag-related functions have `zohoCrm` prefix; 22 functions lack prefixes
- **Recruit**: NO functions have prefixes (33 functions total)
- **Problem**: Unprefixed functions like `insertRecord()` collide between CRM and Recruit

This refactoring will:
1. Add `zohoCrm` prefix to all unprefixed CRM factory functions
2. Add `zohoRecruit` prefix to ALL Recruit factory functions
3. Update related type names for consistency
4. Add COMPAT sections to Recruit files for backward compatibility
5. Update NestJS wrapper imports

## Function Rename Mapping

### CRM Functions (22 to rename)

**Main API (`crm.api.ts`)**: 17 functions
- `insertRecord` → `zohoCrmInsertRecord`
- `updateRecord` → `zohoCrmUpdateRecord`
- `upsertRecord` → `zohoCrmUpsertRecord`
- `deleteRecord` → `zohoCrmDeleteRecord`
- `getRecordById` → `zohoCrmGetRecordById`
- `getRecords` → `zohoCrmGetRecords`
- `searchRecords` → `zohoCrmSearchRecords`
- `searchRecordsPageFactory` → `zohoCrmSearchRecordsPageFactory`
- `getRelatedRecordsFunctionFactory` → `zohoCrmGetRelatedRecordsFunctionFactory`
- `getEmailsForRecord` → `zohoCrmGetEmailsForRecord`
- `getEmailsForRecordPageFactory` → `zohoCrmGetEmailsForRecordPageFactory`
- `getAttachmentsForRecord` → `zohoCrmGetAttachmentsForRecord`
- `getAttachmentsForRecordPageFactory` → `zohoCrmGetAttachmentsForRecordPageFactory`
- `uploadAttachmentForRecord` → `zohoCrmUploadAttachmentForRecord`
- `downloadAttachmentForRecord` → `zohoCrmDownloadAttachmentForRecord`
- `deleteAttachmentFromRecord` → `zohoCrmDeleteAttachmentFromRecord`
- `executeRestApiFunction` → `zohoCrmExecuteRestApiFunction`

**Notes API (`crm.api.notes.ts`)**: 5 functions
- `createNotes` → `zohoCrmCreateNotes`
- `deleteNotes` → `zohoCrmDeleteNotes`
- `getNotesForRecord` → `zohoCrmGetNotesForRecord`
- `getNotesForRecordPageFactory` → `zohoCrmGetNotesForRecordPageFactory`
- `createNotesForRecord` → `zohoCrmCreateNotesForRecord`

**Tags API (`crm.api.tags.ts`)**: ALREADY PREFIXED ✓
- `zohoCrmCreateTagsForModule`, `zohoCrmGetTagsForModule`, etc. (no changes)

### CRM Type Renames (4 types)
- `SearchRecordsPageFactory` → `ZohoCrmSearchRecordsPageFactory`
- `GetEmailsForRecordPageFactory` → `ZohoCrmGetEmailsForRecordPageFactory`
- `GetAttachmentsForRecordPageFactory` → `ZohoCrmGetAttachmentsForRecordPageFactory`
- `GetNotesForRecordPageFactory` → `ZohoCrmGetNotesForRecordPageFactory`

### CRM Additional Colliding Exports

**Error Handling (`crm.error.api.ts`)**: 1 function
- `assertRecordDataArrayResultHasContent` → `assertZohoCrmRecordDataArrayResultHasContent`

**Criteria Utilities (`crm.criteria.ts`)**: 1 const
- `escapeZohoFieldValueForCriteriaString` → `escapeZohoCrmFieldValueForCriteriaString`

**Type Definitions (`crm.ts`)**: 1 interface
- `ZohoRecordDraftStateData` → `ZohoCrmRecordDraftStateData`

**Multi-Record Types (`crm.api.ts`)**: 1 interface (typo fix)
- `ZohoRecrutMultiRecordResultItem` → `ZohoCrmMultiRecordResultItem` (fixing typo "Recrut" → "Crm")

### Recruit Functions (33 to rename)

**Main API (`recruit.api.ts`)**: 17 functions (same as CRM with `zohoRecruit` prefix)
**Notes API (`recruit.api.notes.ts`)**: 5 functions (same pattern as CRM)
**Tags API (`recruit.api.tags.ts`)**: 5 functions
- `createTagsForModule` → `zohoRecruitCreateTagsForModule`
- `getTagsForModule` → `zohoRecruitGetTagsForModule`
- `getTagsForModulePageFactory` → `zohoRecruitGetTagsForModulePageFactory`
- `addTagsToRecords` → `zohoRecruitAddTagsToRecords`
- `removeTagsFromRecords` → `zohoRecruitRemoveTagsFromRecords`

**Candidates API (`recruit.api.candidates.ts`)**: 6 functions
- `associateCandidateRecordsWithJobOpenings` → `zohoRecruitAssociateCandidateRecordsWithJobOpenings`
- `searchAssociatedRecords` → `zohoRecruitSearchAssociatedRecords`
- `searchCandidateAssociatedJobOpeningRecords` → `zohoRecruitSearchCandidateAssociatedJobOpeningRecords`
- `searchCandidateAssociatedJobOpeningRecordsPageFactory` → `zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory`
- `searchJobOpeningAssociatedCandidateRecords` → `zohoRecruitSearchJobOpeningAssociatedCandidateRecords`
- `searchJobOpeningAssociatedCandidateRecordsPageFactory` → `zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory`

### Recruit Type Renames (5 types)
- `SearchRecordsPageFactory` → `ZohoRecruitSearchRecordsPageFactory`
- `GetEmailsForRecordPageFactory` → `ZohoRecruitGetEmailsForRecordPageFactory`
- `GetAttachmentsForRecordPageFactory` → `ZohoRecruitGetAttachmentsForRecordPageFactory`
- `GetNotesForRecordPageFactory` → `ZohoRecruitGetNotesForRecordPageFactory`
- `GetTagsForModulePageFactory` → `ZohoRecruitGetTagsForModulePageFactory`

### Recruit Additional Colliding Exports

**Error Handling (`recruit.error.api.ts`)**: 1 function
- `assertRecordDataArrayResultHasContent` → `assertZohoRecruitRecordDataArrayResultHasContent`

**Criteria Utilities (`recruit.criteria.ts`)**: 1 const
- `escapeZohoFieldValueForCriteriaString` → `escapeZohoRecruitFieldValueForCriteriaString`

**Type Definitions (`recruit.ts`)**: 1 interface
- `ZohoRecordDraftStateData` → `ZohoRecruitRecordDraftStateData`

**Multi-Record Types (`recruit.api.ts`)**: 1 interface (typo fix)
- `ZohoRecrutMultiRecordResultItem` → `ZohoRecruitMultiRecordResultItem` (fixing typo "Recrut" → "Recruit")

## Implementation Steps

### Phase 1: CRM Library (7 files)

**1. Update [crm.api.ts](packages/zoho/src/lib/crm/crm.api.ts)**
- Rename 17 function declarations
- Rename 3 type aliases
- Fix typo: `ZohoRecrutMultiRecordResultItem` → `ZohoCrmMultiRecordResultItem` (line 698)
- Update internal references to use new interface name
- Update JSDoc references if any

**2. Update [crm.ts](packages/zoho/src/lib/crm/crm.ts)**
- Rename interface: `ZohoRecordDraftStateData` → `ZohoCrmRecordDraftStateData` (line 208)
- Update all references in type aliases (lines 217, 222)

**3. Update [crm.error.api.ts](packages/zoho/src/lib/crm/crm.error.api.ts)**
- Rename function: `assertRecordDataArrayResultHasContent` → `assertZohoCrmRecordDataArrayResultHasContent` (line 68)
- Update import in [crm.api.ts](packages/zoho/src/lib/crm/crm.api.ts) (line 28)

**4. Update [crm.criteria.ts](packages/zoho/src/lib/crm/crm.criteria.ts)**
- Rename const: `escapeZohoFieldValueForCriteriaString` → `escapeZohoCrmFieldValueForCriteriaString` (line 116)
- Update internal usage in `zohoCrmSearchRecordsCriteriaEntryToCriteriaString` (line 131)

**5. Update [crm.api.notes.ts](packages/zoho/src/lib/crm/crm.api.notes.ts)**
- Rename 5 function declarations
- Rename 1 type alias
- Update internal call: `getRelatedRecordsFunctionFactory` → `zohoCrmGetRelatedRecordsFunctionFactory`

**6. Update [crm.api.tags.ts](packages/zoho/src/lib/crm/crm.api.tags.ts)**
- Update imports from `./crm.api` to use new prefixed names
- Function definitions already have prefix (no changes)

**7. Update [packages/zoho/nestjs/src/lib/crm/crm.api.ts](packages/zoho/nestjs/src/lib/crm/crm.api.ts)**
- Update 22 import statements to use new prefixed names
- Keep getter method names unchanged (e.g., `get insertRecord()` still returns `zohoCrmInsertRecord(this.crmContext)`)

### Phase 2: Recruit Library (8 files)

**8. Update [recruit.api.ts](packages/zoho/src/lib/recruit/recruit.api.ts)**
- Rename 17 function declarations
- Rename 3 type aliases
- Fix typo: `ZohoRecrutMultiRecordResultItem` → `ZohoRecruitMultiRecordResultItem` (line 698)
- Update internal references to use new interface name
- Add COMPAT section at bottom (see pattern below)

**9. Update [recruit.ts](packages/zoho/src/lib/recruit/recruit.ts)**
- Rename interface: `ZohoRecordDraftStateData` → `ZohoRecruitRecordDraftStateData` (line 158)
- Update all references in type aliases (lines 167, 172)
- Add COMPAT section

**10. Update [recruit.error.api.ts](packages/zoho/src/lib/recruit/recruit.error.api.ts)**
- Rename function: `assertRecordDataArrayResultHasContent` → `assertZohoRecruitRecordDataArrayResultHasContent` (line 68)
- Update import in [recruit.api.ts](packages/zoho/src/lib/recruit/recruit.api.ts) (line 28)
- Add COMPAT section

**11. Update [recruit.criteria.ts](packages/zoho/src/lib/recruit/recruit.criteria.ts)**
- Rename const: `escapeZohoFieldValueForCriteriaString` → `escapeZohoRecruitFieldValueForCriteriaString` (line 116)
- Update internal usage in `zohoRecruitSearchRecordsCriteriaEntryToCriteriaString` (line 131)
- Add COMPAT section

**12. Update [recruit.api.notes.ts](packages/zoho/src/lib/recruit/recruit.api.notes.ts)**
- Rename 5 function declarations
- Rename 1 type alias
- Update internal call: `getRelatedRecordsFunctionFactory` → `zohoRecruitGetRelatedRecordsFunctionFactory`
- Add COMPAT section

**13. Update [recruit.api.tags.ts](packages/zoho/src/lib/recruit/recruit.api.tags.ts)**
- Rename 5 function declarations
- Rename 1 type alias
- Update imports from `./recruit.api` to use new prefixed names
- Add COMPAT section

**14. Update [recruit.api.candidates.ts](packages/zoho/src/lib/recruit/recruit.api.candidates.ts)**
- Rename 6 function declarations
- Update imports from `./recruit.api` to use new prefixed names
- Add COMPAT section

**15. Update [packages/zoho/nestjs/src/lib/recruit/recruit.api.ts](packages/zoho/nestjs/src/lib/recruit/recruit.api.ts)**
- Update 33 import statements to use new prefixed names
- Keep getter method names unchanged

## COMPAT Section Pattern (Recruit Only)

Add this section at the bottom of each updated Recruit file (after existing exports):

```typescript
// MARK: Compat

/**
 * @deprecated Use zohoRecruitInsertRecord instead.
 */
export const insertRecord = zohoRecruitInsertRecord;

/**
 * @deprecated Use ZohoRecruitSearchRecordsPageFactory instead.
 */
export type SearchRecordsPageFactory = ZohoRecruitSearchRecordsPageFactory;

// ... add deprecated exports for ALL renamed functions and types in that file
```

**Example for recruit.api.ts COMPAT section** (17 functions + 3 types = 20 exports):
```typescript
// MARK: Compat

/** @deprecated Use zohoRecruitInsertRecord instead. */
export const insertRecord = zohoRecruitInsertRecord;

/** @deprecated Use zohoRecruitUpdateRecord instead. */
export const updateRecord = zohoRecruitUpdateRecord;

// ... (all 17 functions)

/** @deprecated Use ZohoRecruitSearchRecordsPageFactory instead. */
export type SearchRecordsPageFactory = ZohoRecruitSearchRecordsPageFactory;

// ... (all 3 types)
```

## NestJS Wrapper Pattern

The `ZohoCrmApi` and `ZohoRecruitApi` classes should update their getter implementations:

**Before:**
```typescript
get insertRecord() {
  return insertRecord(this.crmContext);
}
```

**After:**
```typescript
get insertRecord() {
  return zohoCrmInsertRecord(this.crmContext);
}
```

**Note**: Getter method names stay the same; only the function call changes.

## Critical Files to Update

### CRM Files (7 files)
- `/packages/zoho/src/lib/crm/crm.api.ts` (17 functions + 3 types + 1 typo fix)
- `/packages/zoho/src/lib/crm/crm.ts` (1 interface rename)
- `/packages/zoho/src/lib/crm/crm.error.api.ts` (1 function rename)
- `/packages/zoho/src/lib/crm/crm.criteria.ts` (1 const rename + internal usage)
- `/packages/zoho/src/lib/crm/crm.api.notes.ts` (5 functions + 1 type + internal refs)
- `/packages/zoho/src/lib/crm/crm.api.tags.ts` (import updates only)
- `/packages/zoho/nestjs/src/lib/crm/crm.api.ts` (22 import statements)

### Recruit Files (8 files)
- `/packages/zoho/src/lib/recruit/recruit.api.ts` (17 functions + 3 types + 1 typo fix + COMPAT)
- `/packages/zoho/src/lib/recruit/recruit.ts` (1 interface rename + COMPAT)
- `/packages/zoho/src/lib/recruit/recruit.error.api.ts` (1 function rename + COMPAT)
- `/packages/zoho/src/lib/recruit/recruit.criteria.ts` (1 const rename + internal usage + COMPAT)
- `/packages/zoho/src/lib/recruit/recruit.api.notes.ts` (5 functions + 1 type + internal refs + COMPAT)
- `/packages/zoho/src/lib/recruit/recruit.api.tags.ts` (5 functions + 1 type + imports + COMPAT)
- `/packages/zoho/src/lib/recruit/recruit.api.candidates.ts` (6 functions + imports + COMPAT)
- `/packages/zoho/nestjs/src/lib/recruit/recruit.api.ts` (33 import statements)

## Verification

### Build Checks
1. Run `npm run build` in packages/zoho
2. Run `npm run build` in packages/zoho/nestjs
3. Run `npm run lint` to ensure code style
4. Verify no TypeScript errors

### Test Verification
1. Run existing unit tests for `ZohoCrmApi` class
2. Run existing unit tests for `ZohoRecruitApi` class
3. Verify COMPAT exports work (import old names, ensure they resolve to new ones)

### Manual Checks
- [ ] No duplicate function names between CRM and Recruit
- [ ] All internal cross-file references use prefixed names
- [ ] JSDoc comments updated to reference new names
- [ ] NestJS wrappers compile and run correctly
- [ ] COMPAT sections added to all 4 Recruit files
- [ ] All COMPAT exports have `@deprecated` JSDoc tags

### Edge Cases to Watch
1. **Internal function calls**: Functions like `getNotesForRecord` call `getRelatedRecordsFunctionFactory` internally - ensure these use new prefixed names
2. **Type inference**: Verify TypeScript correctly infers types from renamed functions
3. **JSDoc cross-references**: Update any `@see` or `{@link}` tags that reference old function names
4. **Existing COMPAT section**: `recruit.api.ts` already has a `ZohoRecruitGetNotesPageFilter` compat entry at line 745 - preserve this when adding new COMPAT section
5. **Typo fix**: Both `crm.api.ts` and `recruit.api.ts` have `ZohoRecrutMultiRecordResultItem` (typo) that should be fixed to `ZohoCrmMultiRecordResultItem` and `ZohoRecruitMultiRecordResultItem` respectively
6. **Identical utilities**: `escapeZohoFieldValueForCriteriaString` is identical in both CRM and Recruit - consider if these could be shared from a common util file in the future (but rename them now for the refactoring)
7. **Cross-file imports**: `crm.api.ts` imports `assertRecordDataArrayResultHasContent` from `crm.error.api.ts` (line 28) - update this import after renaming
8. **Internal criteria usage**: `zohoCrmSearchRecordsCriteriaEntryToCriteriaString` uses `escapeZohoFieldValueForCriteriaString` internally (line 131) - update this reference

## Order of Execution

1. CRM first (lower risk, no COMPAT needed)
2. Recruit second (more changes, needs COMPAT pattern)
3. Within each: update library files first, then NestJS wrappers last

This bottom-up approach ensures dependencies are updated before consumers.

## Summary of Changes

### CRM Library
- **26 renames total**: 22 functions + 4 utility exports
- **1 typo fix**: `ZohoRecrutMultiRecordResultItem` → `ZohoCrmMultiRecordResultItem`
- **7 files affected**
- **NO COMPAT sections** (CRM doesn't use this pattern)

### Recruit Library
- **37 renames total**: 33 functions + 4 utility exports
- **1 typo fix**: `ZohoRecrutMultiRecordResultItem` → `ZohoRecruitMultiRecordResultItem`
- **8 files affected**
- **7 COMPAT sections** (all library files except nestjs wrapper)

### Utility Renames (both CRM and Recruit)
1. `assertRecordDataArrayResultHasContent` → prefixed version
2. `escapeZohoFieldValueForCriteriaString` → prefixed version
3. `ZohoRecordDraftStateData` → prefixed version
4. `ZohoRecrutMultiRecordResultItem` → fixed typo + prefixed version

## Success Criteria

- ✓ All 26 CRM exports have `zohoCrm` prefix or proper naming
- ✓ All 37 Recruit exports have `zohoRecruit` prefix or proper naming
- ✓ All PageFactory types have proper prefixes
- ✓ Typo fixed in both libraries (`ZohoRecrutMultiRecordResultItem`)
- ✓ No naming collisions between libraries (resolves all 30 TypeScript errors)
- ✓ NestJS wrappers compile without errors
- ✓ All tests pass
- ✓ COMPAT sections provide backward compatibility for Recruit
- ✓ TypeScript compiler shows no errors
- ✓ Cross-file imports updated (error.api.ts → api.ts)

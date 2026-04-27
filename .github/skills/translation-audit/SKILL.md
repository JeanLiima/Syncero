---
name: translation-audit
description: Use when auditing translations in Syncero project - check for missing translations, identify unused keys, clean up translation files, and maintain organization.
---

# Translation Audit

## Overview

This skill provides a systematic approach to audit translations in the Syncero monorepo, ensuring all pages have proper translations, removing unused keys, and maintaining clean, organized translation files.

## Workflow Steps

### 1. Identify Translation Usage

- Search for `t\(['"]([^'"]+)['"]\)` patterns across all apps (landing, flow, books)
- Extract all translation keys being used in components and pages
- Note the file locations where translations are referenced

### 2. Analyze Translation Files

- Read pt.ts and en.ts files in each app's i18n folder
- Extract all defined keys from both languages using regex `^  ([a-zA-Z_]+):`
- Compare key sets between pt and en for consistency (en imports TranslationKey from pt)

### 3. Check Coverage

- Verify all used keys exist in both pt.ts and en.ts
- Identify missing translations for each language
- Flag any keys present in one language but missing in the other

### 4. Find Unused Keys

- Compare defined keys against actually used keys using PowerShell Compare-Object
- Identify keys that exist in translation files but are never referenced
- Flag keys that appear to be unused (note: dynamic usage like t(variable) may not be detected)

### 5. Clean Up

- Automatically remove confirmed unused keys from both pt.ts and en.ts files
- Ensure symmetric removal (if key exists in both, remove from both)
- Maintain alphabetical/logical organization within sections
- Skip removal if key might be used dynamically (requires manual verification)

### 6. Add Missing Translations

- For missing keys, add placeholder entries to pt.ts first (as source of truth)
- Use consistent placeholder format (e.g., "TODO: [key]" or match existing style)
- Ensure both languages get the same keys (en.ts will auto-import)

### 7. Validate Organization

- Check that keys follow naming conventions (snake_case)
- Ensure proper grouping by comments (// Nav, // Dashboard, etc.)
- Verify files are properly formatted and sorted within groups

## Quality Criteria

- All pages/components have complete translations
- No unused keys remain in translation files
- Translation files are consistently organized by feature sections
- Both languages have matching key sets
- No broken references to missing keys (TypeScript compilation passes)

## Tools to Use

- grep_search or run_in_terminal with PowerShell for finding t() calls
- read_file for examining translation files
- run_in_terminal with PowerShell for key extraction and comparison
- replace_string_in_file for automatically removing unused keys
- semantic_search for broader context if needed

## Completion Check

- No missing translations reported
- Unused keys removed
- Files are clean and organized
- TypeScript compilation passes (no missing key errors)

## Syncero-Specific Patterns

- Translation keys use snake_case (e.g., nav_dashboard)
- Files grouped by feature with comment headers (// Nav, // Dashboard)
- pt.ts is the source of truth; en.ts imports TranslationKey from pt
- Use PowerShell commands for key extraction and comparison
- Automatic cleanup removes unused keys from both files simultaneously
- Placeholder for missing keys: match existing style or use "TODO: [key]"

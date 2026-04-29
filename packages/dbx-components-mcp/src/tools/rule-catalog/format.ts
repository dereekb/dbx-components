/**
 * Renderers for `dbx_explain_rule`. Markdown is the default; JSON
 * is the structured form for downstream programmatic consumption.
 */

import type { RuleEntry, RuleSeeAlso } from './types.js';

/**
 * Renders one catalog entry as a markdown block consumed by
 * `dbx_explain_rule`. Sections appear in this fixed order so callers
 * can rely on the layout: title, metadata block, what-it-flags,
 * when-it-applies, when-it-does-NOT-apply, canonical fix, optional
 * fix template, optional see-also list.
 *
 * @param entry - the rule entry to render
 * @returns the formatted markdown text
 */
export function formatRuleAsMarkdown(entry: RuleEntry): string {
  const lines: string[] = [];
  lines.push(`# \`${entry.code}\``, '');
  lines.push(`**${entry.title}**`, '');
  lines.push(`- **Severity:** \`${entry.severity}\``);
  lines.push(`- **Source tool:** \`${entry.source}\``);
  lines.push('');
  lines.push('## What it flags', '', entry.whatItFlags, '');
  lines.push('## When it applies', '', entry.whenItApplies, '');
  lines.push('## When it does NOT apply', '', entry.whenItDoesNotApply, '');
  lines.push('## Canonical fix', '', entry.canonicalFix, '');
  if (entry.canonicalFixTemplate) {
    lines.push('## Fix template', '', entry.canonicalFixTemplate, '');
  }
  if (entry.seeAlso && entry.seeAlso.length > 0) {
    lines.push('## See also', '');
    for (const ref of entry.seeAlso) {
      lines.push(`- ${formatSeeAlso(ref)}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/**
 * Renders one catalog entry as a JSON string. Pre-formatted with
 * 2-space indentation so the MCP `text` content is human-scannable.
 *
 * @param entry - the rule entry to render
 * @returns the formatted JSON text
 */
export function formatRuleAsJson(entry: RuleEntry): string {
  return JSON.stringify(entry, null, 2);
}

/**
 * Renders a single see-also reference. `kind` selects how the link is
 * presented — `tool` references point at another MCP tool by name,
 * `artifact` references resolve through `dbx_artifact_file_convention`,
 * and `doc` is a free-form pointer.
 *
 * @param ref - the see-also reference
 * @returns one bullet-friendly line
 */
function formatSeeAlso(ref: RuleSeeAlso): string {
  const tail = ref.note ? ` — ${ref.note}` : '';
  if (ref.kind === 'tool') return `Tool: \`${ref.target}\`${tail}`;
  if (ref.kind === 'artifact') return `Artifact: \`${ref.target}\` (look up via \`dbx_artifact_file_convention artifact="${ref.target}"\`)${tail}`;
  return `Doc: ${ref.target}${tail}`;
}

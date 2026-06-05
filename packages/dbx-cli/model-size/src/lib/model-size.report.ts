import { type ModelSizeReport } from './model-size.run';

/**
 * Max number of fields listed in the breakdown section of the rendered report.
 */
export const MODEL_SIZE_BREAKDOWN_LIMIT = 20;

function formatBytes(bytes: number): string {
  const kib = bytes / 1024;
  return `${bytes.toLocaleString('en-US')} bytes (${kib.toFixed(2)} KiB)`;
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

/**
 * Renders a {@link ModelSizeReport} as a human-readable, multi-line report.
 *
 * The stringified byte size is the headline; the Firestore-formula estimate is
 * shown as a clearly-labelled secondary figure (it is closer to the real 1 MB
 * trigger but ignores the document name/path and index entries).
 *
 * @param report - The structured run result.
 * @returns The formatted report text (no trailing newline).
 *
 * @example
 * ```ts
 * process.stdout.write(`${formatModelSizeReport(report)}\n`);
 * ```
 */
export function formatModelSizeReport(report: ModelSizeReport): string {
  const lines: string[] = [];

  lines.push(`Snapshot size — ${report.exportName}`);
  lines.push(`  source: ${report.sourceFile}`);
  lines.push('');
  lines.push(`  stringified size : ${formatBytes(report.bytes)}  [headline]`);
  lines.push(`  limit            : ${formatBytes(report.limitBytes)}`);
  lines.push(`  used             : ${formatPercent(report.percentOfLimit)}  ${report.withinLimit ? 'OK — within limit' : 'OVER LIMIT'}`);
  lines.push(`  firestore approx : ${formatBytes(report.firestoreApproxBytes)}  [secondary — ignores doc name/path + indexes]`);

  if (report.breakdown.length > 0) {
    const keyWidth = Math.min(32, Math.max(...report.breakdown.map((entry) => entry.key.length)));
    lines.push('');
    lines.push('  Largest fields (of stringified size):');

    for (const entry of report.breakdown.slice(0, MODEL_SIZE_BREAKDOWN_LIMIT)) {
      lines.push(`    ${entry.key.padEnd(keyWidth)}  ${String(entry.bytes).padStart(10)} bytes  ${formatPercent(entry.percent).padStart(7)}`);
    }

    if (report.breakdown.length > MODEL_SIZE_BREAKDOWN_LIMIT) {
      lines.push(`    … and ${report.breakdown.length - MODEL_SIZE_BREAKDOWN_LIMIT} more`);
    }
  }

  if (report.solve) {
    const { solve } = report;
    lines.push('');
    lines.push(`  Solve-for-N — '${solve.path}':`);

    if (solve.cappedAtProbeLimit) {
      lines.push(`    at least ${solve.maxCount.toLocaleString('en-US')} fit within the limit (probe cap reached; raise it to find the true max)`);
      lines.push(`    size at ${solve.maxCount.toLocaleString('en-US')} : ${formatBytes(solve.bytesAtMax)}`);
    } else {
      lines.push(`    max that fits : ${solve.maxCount.toLocaleString('en-US')}  (${formatBytes(solve.bytesAtMax)})`);
      lines.push(`    next (${(solve.maxCount + 1).toLocaleString('en-US')}) : ${formatBytes(solve.bytesAtNext)} — exceeds limit`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('  Warnings:');

    for (const warning of report.warnings) {
      lines.push(`    - ${warning}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate Curated Seeds — Sweeps candidate seeds per scenario and outputs
 * a TypeScript file with pre-validated seeds that meet the experience contract.
 *
 * Usage: npm run generate-seeds
 *
 * For each scenario, tests CANDIDATES_PER_SCENARIO seeds (default 500).
 * Each seed is validated against both "diversified" and "corn-only" strategies.
 * Approved seeds are written to src/data/curated-seeds.ts.
 *
 * Runtime: ~500 seeds × 5 scenarios × 2 strategies × ~25ms/sim ≈ 125s
 */

import { SCENARIOS, SCENARIO_IDS } from '../src/data/scenarios.ts';
import { isSeedApproved, validateSeed } from '../src/engine/seed-validator.ts';

const CANDIDATES_PER_SCENARIO = 500;
const MIN_SEEDS_PER_SCENARIO = 20;

interface ScenarioSummary {
  scenarioId: string;
  tested: number;
  approved: number;
  seeds: number[];
}

function generateForScenario(scenarioId: string): ScenarioSummary {
  const seeds: number[] = [];
  let tested = 0;

  for (let i = 1; i <= CANDIDATES_PER_SCENARIO; i++) {
    const seed = i * 1000; // Spread seeds to avoid clustering
    tested++;

    if (isSeedApproved(scenarioId, seed)) {
      seeds.push(seed);
    }

    // Progress output every 100 seeds
    if (i % 100 === 0) {
      console.log(`  ${scenarioId}: ${i}/${CANDIDATES_PER_SCENARIO} tested, ${seeds.length} approved`);
    }
  }

  return { scenarioId, tested, approved: seeds.length, seeds };
}

function writeOutputFile(results: ScenarioSummary[]): string {
  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * Pre-validated seeds per scenario. Each seed produces a 30-year run');
  lines.push(' * that meets the experience contract for BOTH diversified and corn-only strategies.');
  lines.push(' * See src/engine/seed-validator.ts for contract details.');
  lines.push(' *');
  lines.push(` * Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push(' * Re-generate after adding seasonal-draw events: npm run generate-seeds');
  lines.push(' */');
  lines.push('');
  lines.push('export const CURATED_SEEDS: Record<string, number[]> = {');

  for (const result of results) {
    // Format seeds as wrapped array for readability
    const seedStr = result.seeds.join(', ');
    if (seedStr.length <= 80) {
      lines.push(`  '${result.scenarioId}': [${seedStr}],`);
    } else {
      lines.push(`  '${result.scenarioId}': [`);
      // Wrap at ~80 chars per line
      let line = '    ';
      for (let i = 0; i < result.seeds.length; i++) {
        const entry = i < result.seeds.length - 1 ? `${result.seeds[i]}, ` : `${result.seeds[i]}`;
        if (line.length + entry.length > 90) {
          lines.push(line);
          line = '    ' + entry;
        } else {
          line += entry;
        }
      }
      if (line.trim()) lines.push(line);
      lines.push('  ],');
    }
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

console.log('Generating curated seed pool...');
console.log(`Testing ${CANDIDATES_PER_SCENARIO} candidates per scenario × ${SCENARIO_IDS.length} scenarios`);
console.log('');

const results: ScenarioSummary[] = [];
const startTime = performance.now();

for (const scenarioId of SCENARIO_IDS) {
  console.log(`Scenario: ${scenarioId}`);
  const result = generateForScenario(scenarioId);
  results.push(result);
  console.log(`  Result: ${result.approved}/${result.tested} seeds approved (${((result.approved / result.tested) * 100).toFixed(1)}%)`);
  console.log('');
}

const totalMs = performance.now() - startTime;

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
for (const r of results) {
  const pct = ((r.approved / r.tested) * 100).toFixed(1);
  console.log(`  ${r.scenarioId}: ${r.approved} seeds (${pct}%)`);
}
console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s`);
console.log('');

// Check minimums
const failing = results.filter(r => r.approved < MIN_SEEDS_PER_SCENARIO);
if (failing.length > 0) {
  console.error('WARNING: Some scenarios have fewer than minimum required seeds:');
  for (const f of failing) {
    console.error(`  ${f.scenarioId}: only ${f.approved} (need ${MIN_SEEDS_PER_SCENARIO})`);
  }
  console.error('Consider loosening experience contract thresholds.');
  process.exit(1);
}

// Write output
const output = writeOutputFile(results);
const outputPath = new URL('../src/data/curated-seeds.ts', import.meta.url).pathname;

// Use Node fs to write
import { writeFileSync } from 'node:fs';
writeFileSync(outputPath, output, 'utf-8');

console.log(`Written to: src/data/curated-seeds.ts`);
console.log('Done.');

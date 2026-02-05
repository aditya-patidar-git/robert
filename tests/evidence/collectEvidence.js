/**
 * Evidence collection runner: runs unit + integration tests with JSON output,
 * ingests results into EvidenceAggregator, generates Evidence Packs. Run twice for acceptance.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { EvidenceAggregator } from './evidenceAggregator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unitResultsPath = path.join(__dirname, 'unit-results.json');
const integrationResultsPath = path.join(__dirname, 'integration-results.json');

const jestBin = 'node --experimental-vm-modules node_modules/jest/bin/jest.js';

const JEST_TIMEOUT_MS = 120000;

async function runJest(testPath, outputPath) {
  const cmd = `${jestBin} ${testPath} --json --outputFile=${outputPath}`;
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '../..'), timeout: JEST_TIMEOUT_MS });
  } catch (err) {
    // Jest exits non-zero on failure or timeout; we still ingest results and generate pack
  }
}

export async function collectEvidence(runNumber = 1) {
  await fs.mkdir(path.join(__dirname, 'packs'), { recursive: true });

  console.log(`[collectEvidence] Run ${runNumber}: unit tests...`);
  runJest('tests/unit', unitResultsPath);

  console.log(`[collectEvidence] Run ${runNumber}: integration tests...`);
  runJest('tests/integration', integrationResultsPath);

  const aggregator = new EvidenceAggregator(path.join(__dirname, 'artifacts'));

  if (await fs.access(unitResultsPath).then(() => true).catch(() => false)) {
    await aggregator.ingestJestResults(unitResultsPath);
  } else {
    console.warn('[collectEvidence] No unit results file found');
  }
  if (await fs.access(integrationResultsPath).then(() => true).catch(() => false)) {
    await aggregator.ingestJestResults(integrationResultsPath);
  } else {
    console.warn('[collectEvidence] No integration results file found');
  }

  if (process.env.COLLECT_ARTIFACTS === '1') {
    try {
      const scriptPath = path.join(__dirname, 'scripts', 'collectArtifacts.js');
      const mod = await import(scriptPath);
      if (typeof mod.collectArtifacts === 'function') {
        await mod.collectArtifacts(aggregator);
      }
    } catch {
      // optional
    }
  }

  const pack = await aggregator.generateEvidencePack(runNumber);
  return pack;
}

export async function runAcceptance() {
  console.log('Acceptance Test Evidence Collection');
  console.log('====================================\n');

  const pack1 = await collectEvidence(1);

  console.log('\n[collectEvidence] Pausing 5s before Run 2...\n');
  await new Promise((r) => setTimeout(r, 5000));

  const pack2 = await collectEvidence(2);

  const run1Ok = pack1.summary.failed === 0 && pack1.summary.incomplete === 0;
  const run2Ok = pack2.summary.failed === 0 && pack2.summary.incomplete === 0;

  console.log('\n====================================');
  console.log('Acceptance results');
  console.log('====================================');
  console.log(`Run 1: ${run1Ok ? 'PASSED' : 'FAILED'} (${pack1.summary.passed}/${pack1.summary.totalRequirements} requirements)`);
  console.log(`Run 2: ${run2Ok ? 'PASSED' : 'FAILED'} (${pack2.summary.passed}/${pack2.summary.totalRequirements} requirements)`);
  console.log(`Evidence packs: ${pack1.packPath}, ${pack2.packPath}`);

  if (run1Ok && run2Ok) {
    console.log('\nAcceptance complete: all requirements verified twice.');
    process.exit(0);
  } else {
    console.log('\nAcceptance failed: see evidence packs for details.');
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('collectEvidence.js')) {
  runAcceptance().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

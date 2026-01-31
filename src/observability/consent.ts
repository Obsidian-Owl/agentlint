/**
 * EP22 US-005 T057: OTLP consent flow
 * Shows user consent message on first remote telemetry opt-in.
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// =============================================================================
// Constants
// =============================================================================

const CONSENT_FILE_PATH = join(homedir(), '.agentlint', 'otlp-consent.json');

interface ConsentRecord {
  /** ISO-8601 timestamp when consent was granted */
  consentedAt: string;
  /** OTLP endpoint consented to */
  endpoint: string;
}

// =============================================================================
// Consent Management
// =============================================================================

/**
 * Check if OTLP consent has been granted for the current endpoint.
 */
function hasOtlpConsent(): boolean {
  if (!existsSync(CONSENT_FILE_PATH)) {
    return false;
  }

  try {
    const content = readFileSync(CONSENT_FILE_PATH, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const record: ConsentRecord = JSON.parse(content);
    return !!record.consentedAt;
  } catch {
    return false;
  }
}

/**
 * Record OTLP consent.
 */
function recordOtlpConsent(endpoint: string): void {
  const dir = join(homedir(), '.agentlint');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const record: ConsentRecord = {
    consentedAt: new Date().toISOString(),
    endpoint,
  };

  writeFileSync(CONSENT_FILE_PATH, JSON.stringify(record, null, 2), { mode: 0o600 });
}

/**
 * Show OTLP consent message if this is the first time enabling remote telemetry.
 * Only shows once per endpoint.
 */
export function showOtlpConsentIfNeeded(): void {
  // Skip if already consented
  if (hasOtlpConsent()) {
    return;
  }

  const endpoint =
    process.env['AGENTLINT_OTLP_ENDPOINT'] ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

  if (!endpoint) {
    // No endpoint configured - nothing to consent to
    return;
  }

  // Show consent message
  console.log('\n' + '='.repeat(70));
  console.log('Remote Observability Opt-In');
  console.log('='.repeat(70));
  console.log('');
  console.log('You have enabled remote telemetry export to:');
  console.log(`  ${endpoint}`);
  console.log('');
  console.log('What will be sent:');
  console.log('  ✓ Session statistics (duration, tool calls, findings)');
  console.log('  ✓ Error types (not messages)');
  console.log('  ✓ Token usage (aggregate, not content)');
  console.log('');
  console.log('What will NOT be sent:');
  console.log('  ✗ Prompts or completions');
  console.log('  ✗ File contents');
  console.log('  ✗ API keys or secrets');
  console.log('');
  console.log('All data is automatically sanitized before export.');
  console.log('');
  console.log('To disable: unset AGENTLINT_TELEMETRY environment variable');
  console.log('='.repeat(70));
  console.log('');

  // Record consent
  recordOtlpConsent(endpoint);
}

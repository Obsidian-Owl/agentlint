/**
 * EP22: Observability Configuration
 */

export interface ObservabilityConfig {
  /** Enable local file logging */
  localLogging: boolean;
  /** Local log directory */
  logDir: string;
  /** Enable OTLP export */
  otlpEnabled: boolean;
  /** OTLP endpoint URL */
  otlpEndpoint?: string;
  /** Sample rate (0.0 - 1.0) */
  sampleRate: number;
  /** Service name for traces */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
}

export const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityConfig = {
  localLogging: true,
  logDir: '~/.agentlint/logs',
  otlpEnabled: false,
  // Don't include otlpEndpoint - it's optional
  sampleRate: 1.0,
  serviceName: 'agentlint',
  serviceVersion: '0.1.0',
};

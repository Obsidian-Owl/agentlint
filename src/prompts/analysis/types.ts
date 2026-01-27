/**
 * Analysis Prompt Types
 *
 * Types for the analysis prompt context and rendering.
 *
 * @module prompts/analysis/types
 */

import type { ScanResult } from '../../cli/commands/scan';
import type { AnalyseOptions } from '../../cli/commands/analyse';

/**
 * Prompt sections for analysis workflow.
 * Kept for backward compatibility with existing prompt structure.
 */
export interface AnalysisPromptSections {
  /** Introductory context for the analysis */
  intro: string;
  /** The main workflow steps (DETECT, TRACE, etc.) */
  workflow: string;
  /** Output formatting requirements */
  outputRequirements: string;
}

/**
 * Context required to render the analysis prompt.
 * Passed to PromptSpec.render() at runtime.
 */
export interface AnalysisContext {
  /** Directory being analyzed */
  directory: string;
  /** Results from configuration scan */
  scanResult: ScanResult;
  /** Analysis options from CLI */
  options: AnalyseOptions & { promptVersion?: string };
  /** Pre-loaded existing recommendations context (async-loaded before render) */
  existingRecsContext: string;
}

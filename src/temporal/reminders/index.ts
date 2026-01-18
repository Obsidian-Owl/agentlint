/**
 * EP09 Temporal Analysis - Review Reminders
 *
 * Exports review trigger detection and configuration.
 *
 * @module temporal/reminders
 */

export {
  checkInflectionTrigger,
  checkTimeTrigger,
  checkThresholdTrigger,
  checkAllTriggers,
  getDefaultTriggerConfig,
  type TriggerType,
  type TriggerReason,
  type TriggerCheckResult,
  type TriggerConfig,
} from './triggers';

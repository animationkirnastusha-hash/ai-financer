import { env } from '../../config/env';
import { MonitoringService } from './monitoring.service';

export const monitoringService = new MonitoringService({
  slowRequestMs: env.apiSlowRequestMs,
  errorRateThreshold: env.apiErrorRateThreshold,
  alertCooldownMs: env.adminAlertCooldownMs,
  alertsEnabled: env.adminAlertsEnabled,
  alertWebhookUrl: env.adminAlertWebhookUrl || undefined,
});

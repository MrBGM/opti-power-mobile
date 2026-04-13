export type AlertId = string;

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlertProjection {
  id: AlertId;
  title: string;
  equipmentId?: string | null;
  equipmentName?: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  triggeredAt: string;
  createdAt: string;
  updatedAt: string;
}

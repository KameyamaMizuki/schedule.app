/**
 * 共通型定義
 */

export interface ScheduleSlots {
  [slotKey: string]: boolean; // "2025-01-06:allday", "2025-01-06:09" etc.
}

export interface NotesByDate {
  [dateStr: string]: string; // "2025-01-06": "備考内容"
}

export interface ScheduleInput {
  weekId: string;
  userId: string;
  displayName: string;
  slots: ScheduleSlots;
  notes?: NotesByDate;
  submittedAt: string;
  isLocked: boolean;
  ttl?: number;
}

export interface PointsBreakdown {
  displayName: string;
  weekdayPoints: number;
  weekendBonusPoints: number;
  totalPoints: number;
}

export interface WeeklyFinalized {
  weekId: string;
  finalizedAt: string;
  scheduleText: string;
  pointsBreakdown: { [userId: string]: PointsBreakdown };
  messageId?: string;
  version: number;
  ttl?: number;
}

export interface UserPoints {
  userId: string;
  displayName: string;
  totalPoints: number;
  weekdayPoints: number;
  weekendBonusPoints: number;
  lastUpdatedWeek: string;
  updatedAt: string;
}

export interface SystemConfig {
  groupId: string;
  adminUserId: string;
  timezone: string;
}

export interface ScheduleSubmitRequest {
  weekId: string;
  userId: string;
  slots: ScheduleSlots;
  notes?: NotesByDate;
  displayName: string;
}

export interface ScheduleGetResponse {
  weekId: string;
  startDate: string;
  endDate: string;
  deadline: string;
  isLocked: boolean;
  slots: ScheduleSlots;
  notes?: NotesByDate;
  isAdmin: boolean;
}

export const TIME_SLOTS = ['allday', '09', '17', '21', '24'] as const;
export type TimeSlot = typeof TIME_SLOTS[number];

export const DAYS_OF_WEEK = ['月', '火', '水', '木', '金', '土', '日'] as const;

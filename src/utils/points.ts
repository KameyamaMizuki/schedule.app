/**
 * ポイント計算ロジック
 */

import { ScheduleSlots, PointsBreakdown } from '../types';
import { isWeekend } from './weekId';

export function calculatePoints(slots: ScheduleSlots): PointsBreakdown {
  let weekdayPoints = 0;
  let weekendTotalPoints = 0;

  // 日付ごとに「終日」が選択されているかチェック
  const alldayDates = new Set<string>();
  for (const [slotKey, checked] of Object.entries(slots)) {
    if (!checked) continue;
    const [dateStr, timeSlot] = slotKey.split(':');
    if (timeSlot === 'allday') {
      alldayDates.add(dateStr);
    }
  }

  for (const [slotKey, checked] of Object.entries(slots)) {
    if (!checked) continue;

    const [dateStr, timeSlot] = slotKey.split(':');

    // 終日が選択されている日の他の時間帯は無視
    if (alldayDates.has(dateStr) && timeSlot !== 'allday') {
      continue;
    }

    const isWeekendDay = isWeekend(dateStr);

    let basePoints = 0;
    if (timeSlot === 'allday') {
      basePoints = 4;
    } else {
      basePoints = 1; // 9/17/21/24
    }

    if (isWeekendDay) {
      // 土日は1.5倍
      weekendTotalPoints += basePoints * 1.5;
    } else {
      weekdayPoints += basePoints;
    }
  }

  // 土日加算Pは0.5倍分のみ（増えた分）
  const weekendBonusPoints = Math.round(weekendTotalPoints - (weekendTotalPoints / 1.5));

  return {
    displayName: '', // 呼び出し元でセット
    weekdayPoints,
    weekendBonusPoints,
    totalPoints: weekdayPoints + Math.round(weekendTotalPoints)
  };
}

/**
 * 複数ユーザーのポイントを計算
 */
export function calculateAllPoints(
  inputs: Array<{ userId: string; displayName: string; slots: ScheduleSlots }>
): { [userId: string]: PointsBreakdown } {
  const result: { [userId: string]: PointsBreakdown } = {};

  for (const input of inputs) {
    const points = calculatePoints(input.slots);
    result[input.userId] = {
      ...points,
      displayName: input.displayName
    };
  }

  return result;
}

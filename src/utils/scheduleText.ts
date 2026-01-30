/**
 * スケジュール確定表テキスト生成ユーティリティ
 */

import { getDayOfWeekJa } from './weekId';
import { PointsBreakdown } from '../types';

export interface ScheduleInputForText {
  userId: string;
  displayName: string;
  slots: { [key: string]: boolean };
  notes?: { [dateStr: string]: string };
}

/**
 * 特定の日時枠に誰がいるか取得
 */
function getParticipants(
  inputs: ScheduleInputForText[],
  dateStr: string,
  timeSlot: string
): string[] {
  const slotKey = `${dateStr}:${timeSlot}`;
  return inputs
    .filter(input => input.slots[slotKey])
    .map(input => input.displayName);
}

/**
 * 確定表テキスト生成
 */
export function buildFinalizedSchedule(
  dates: string[],
  inputs: ScheduleInputForText[],
  pointsBreakdown: { [userId: string]: PointsBreakdown },
  nextWeekDashboardUrl?: string
): string {
  let text = '今週のスケジュール確定版です。\n\n';
  const absentDays: string[] = [];

  for (const dateStr of dates) {
    const month = parseInt(dateStr.split('-')[1], 10);
    const day = parseInt(dateStr.split('-')[2], 10);
    const dayOfWeek = getDayOfWeekJa(dateStr);

    text += `${month}/${day}(${dayOfWeek})\n`;

    // 各時間枠で誰がいるか
    const allday = getParticipants(inputs, dateStr, 'allday');
    const slot09 = getParticipants(inputs, dateStr, '09');
    const slot17 = getParticipants(inputs, dateStr, '17');
    const slot21 = getParticipants(inputs, dateStr, '21');
    const slot24 = getParticipants(inputs, dateStr, '24');

    text += `終日:【${allday.join('、')}】\n`;
    text += `9時:【${slot09.join('、')}】/17時:【${slot17.join('、')}】/21時:【${slot21.join('、')}】/24時:【${slot24.join('、')}】\n`;

    // 全時間帯で誰もいない日をチェック
    if (allday.length === 0 && slot09.length === 0 && slot17.length === 0 && slot21.length === 0 && slot24.length === 0) {
      absentDays.push(`${month}/${day}(${dayOfWeek})`);
    }

    // 備考がある場合は表示
    for (const input of inputs) {
      if (input.notes && input.notes[dateStr]) {
        text += `  ${input.displayName}:${input.notes[dateStr]}\n`;
      }
    }
  }

  // 担当者不在の日を警告
  if (absentDays.length > 0) {
    text += '\n⚠️ 担当者不在の日があります：\n';
    for (const d of absentDays) {
      text += `  ${d}\n`;
    }
    text += '確認してください。\n';
  }

  // 今週ポイント
  text += '\n今回のポイントは以下です。\n';
  for (const [, points] of Object.entries(pointsBreakdown)) {
    text += `${points.displayName}：${points.totalPoints}P（平日${points.weekdayPoints}P + 土日加算${points.weekendBonusPoints}P）\n`;
  }

  // 来週の入力案内
  if (nextWeekDashboardUrl) {
    text += `\nまた来週の入力もお願いします。\n▼確認・入力はこちら\n${nextWeekDashboardUrl}`;
  }

  return text;
}

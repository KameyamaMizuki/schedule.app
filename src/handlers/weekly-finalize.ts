/**
 * 毎週月曜0:00：確定処理・ポイント集計（通知なし）
 * EventBridge Scheduler → Lambda
 * 締切は日曜23:59
 */

import { Handler } from 'aws-lambda';
import {
  getAllScheduleInputs,
  saveWeeklyFinalized,
  getWeeklyFinalized,
  getUserPoints,
  updateUserPoints
} from '../utils/dynamodb';
import { generateNextWeekId, getWeekInfo, getCurrentWeekId } from '../utils/weekId';
import { calculateAllPoints } from '../utils/points';
import { buildFinalizedSchedule } from '../utils/scheduleText';
import { getDashboardUrl } from '../utils/constants';
import { PointsBreakdown } from '../types';

export const handler: Handler = async () => {
  try {
    // 【重要】月曜0:00実行 → 今週（月~日）を確定
    // 例: 1/19(月)0:00実行 → 1/19~1/25週を確定
    const weekId = getCurrentWeekId();
    const weekInfo = getWeekInfo(weekId);

    console.log(`Starting finalization for weekId: ${weekId}`);

    // 【重複確定防止】既に確定済みかチェック
    const existingFinalized = await getWeeklyFinalized(weekId);
    const isAlreadyFinalized = !!existingFinalized;

    if (isAlreadyFinalized) {
      console.log(`Week ${weekId} is already finalized. Skipping cumulative points update.`);
    }

    // 全入力取得
    const inputs = await getAllScheduleInputs(weekId);

    if (inputs.length === 0) {
      console.warn('No inputs found for weekId:', weekId);
      return { statusCode: 200, message: 'No inputs' };
    }

    // ポイント計算
    const pointsBreakdown = calculateAllPoints(inputs);

    // 来週のダッシュボードURL（入力用）
    const nextWeekId = generateNextWeekId();
    const nextWeekDashboardUrl = getDashboardUrl(nextWeekId);

    // 確定表テキスト生成（共通ユーティリティ使用）
    const scheduleText = buildFinalizedSchedule(weekInfo.dates, inputs, pointsBreakdown, nextWeekDashboardUrl);

    // 週次確定データ保存
    await saveWeeklyFinalized({
      weekId,
      finalizedAt: new Date().toISOString(),
      scheduleText,
      pointsBreakdown,
      version: existingFinalized ? (existingFinalized.version || 0) + 1 : 0
    });

    // 【重複確定防止】初回のみ累計ポイント更新
    if (!isAlreadyFinalized) {
      await updateCumulativePoints(pointsBreakdown);
      console.log('Cumulative points updated for weekId:', weekId);
    } else {
      console.log('Cumulative points NOT updated (already finalized) for weekId:', weekId);
    }

    console.log('Weekly finalization completed for weekId:', weekId);
    return { statusCode: 200, message: 'Success', weekId };
  } catch (error) {
    console.error('Weekly finalize error:', error);
    return { statusCode: 500, message: 'Failed to finalize weekly schedule' };
  }
};

/**
 * 累計ポイント更新
 */
async function updateCumulativePoints(
  pointsBreakdown: { [userId: string]: PointsBreakdown }
): Promise<void> {
  for (const [userId, weekPoints] of Object.entries(pointsBreakdown)) {
    const current = await getUserPoints(userId);

    if (current) {
      // 既存累計に加算
      await updateUserPoints({
        userId,
        displayName: weekPoints.displayName,
        totalPoints: current.totalPoints + weekPoints.totalPoints,
        weekdayPoints: current.weekdayPoints + weekPoints.weekdayPoints,
        weekendBonusPoints: current.weekendBonusPoints + weekPoints.weekendBonusPoints,
        lastUpdatedWeek: generateNextWeekId(),
        updatedAt: new Date().toISOString()
      });
    } else {
      // 初回
      await updateUserPoints({
        userId,
        displayName: weekPoints.displayName,
        totalPoints: weekPoints.totalPoints,
        weekdayPoints: weekPoints.weekdayPoints,
        weekendBonusPoints: weekPoints.weekendBonusPoints,
        lastUpdatedWeek: generateNextWeekId(),
        updatedAt: new Date().toISOString()
      });
    }
  }
}

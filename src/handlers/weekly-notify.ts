/**
 * 毎週月曜6:00：確定スケジュール通知
 * EventBridge Scheduler → Lambda
 * 確定処理（0:00）完了後に通知のみ実行
 */

import { Handler } from 'aws-lambda';
import { getWeeklyFinalized, getSystemConfig } from '../utils/dynamodb';
import { getCurrentWeekId } from '../utils/weekId';
import { getLineCredentials } from '../utils/secrets';
import { pushMessage } from '../utils/line';

export const handler: Handler = async () => {
  try {
    // 【重要】月曜6:00実行 → 今週（月~日）の確定データを通知
    // 確定処理（月曜0:00）でgetCurrentWeekId()を使って確定しているため、同じIDを使う
    // 例: 2/2(月)6:00実行 → 2/2~2/8週の確定スケジュールを通知
    const weekId = getCurrentWeekId();

    console.log(`Starting notification for weekId: ${weekId}`);

    // 確定データ取得
    const finalized = await getWeeklyFinalized(weekId);

    if (!finalized) {
      console.error('No finalized data found for weekId:', weekId);
      return { statusCode: 404, message: 'No finalized data' };
    }

    // LINE通知
    const config = await getSystemConfig();
    if (config?.groupId) {
      const credentials = await getLineCredentials();
      await pushMessage(config.groupId, finalized.scheduleText, credentials.channelAccessToken);
      console.log('Notification sent for weekId:', weekId);
    } else {
      console.warn('No groupId configured, skipping notification');
    }

    console.log('Weekly notification completed for weekId:', weekId);
    return { statusCode: 200, message: 'Success', weekId };
  } catch (error) {
    console.error('Weekly notify error:', error);
    return { statusCode: 500, message: 'Failed to send weekly notification' };
  }
};


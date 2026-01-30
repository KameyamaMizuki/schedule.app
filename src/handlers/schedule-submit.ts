/**
 * POST /schedule/submit
 * スケジュール入力保存API（変更検出機能付き）
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { ScheduleSubmitRequest } from '../types';
import { saveScheduleInput, getScheduleInput, getSystemConfig } from '../utils/dynamodb';
import { getLineCredentials } from '../utils/secrets';
import { pushMessage } from '../utils/line';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

interface ChangeInfo {
  addedSlots: string[];
  removedSlots: string[];
  changedNotes: Array<{ date: string; oldNote: string; newNote: string }>;
}

/**
 * 既存データと新規データを比較して変更箇所を検出
 */
async function detectChanges(
  weekId: string,
  userId: string,
  newSlots: { [key: string]: boolean },
  newNotes: { [dateStr: string]: string } | undefined
): Promise<{ changes: ChangeInfo | null; isNewEntry: boolean }> {
  const existing = await getScheduleInput(weekId, userId);

  if (!existing) {
    return { changes: null, isNewEntry: true };
  }

  const changes: ChangeInfo = { addedSlots: [], removedSlots: [], changedNotes: [] };

  // スロット変更検出
  const allSlotKeys = new Set([
    ...Object.keys(existing.slots || {}),
    ...Object.keys(newSlots)
  ]);

  for (const key of allSlotKeys) {
    const wasSelected = existing.slots?.[key] || false;
    const isSelected = newSlots[key] || false;
    if (!wasSelected && isSelected) {
      changes.addedSlots.push(key);
    } else if (wasSelected && !isSelected) {
      changes.removedSlots.push(key);
    }
  }

  // 備考変更検出
  const allDateKeys = new Set([
    ...Object.keys(existing.notes || {}),
    ...Object.keys(newNotes || {})
  ]);

  for (const date of allDateKeys) {
    const oldNote = existing.notes?.[date] || '';
    const newNote = newNotes?.[date] || '';
    if (oldNote !== newNote) {
      changes.changedNotes.push({ date, oldNote, newNote });
    }
  }

  const hasChanges = changes.addedSlots.length > 0 ||
                     changes.removedSlots.length > 0 ||
                     changes.changedNotes.length > 0;

  return { changes: hasChanges ? changes : null, isNewEntry: false };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // CORS対応
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    const body: ScheduleSubmitRequest = JSON.parse(event.body || '{}');
    const { weekId, userId, slots, notes, displayName } = body;

    if (!weekId || !userId || !slots || !displayName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const credentials = await getLineCredentials();

    // 変更検出（保存前に実行）
    const { changes, isNewEntry } = await detectChanges(weekId, userId, slots, notes);

    // 保存
    await saveScheduleInput({
      weekId,
      userId,
      displayName,
      slots,
      notes: notes || {},
      submittedAt: new Date().toISOString(),
      isLocked: false
    });

    // グループに通知
    const config = await getSystemConfig();
    if (config?.groupId) {
      const s3BaseUrl = 'https://family-schedule-web-kame-982312822872.s3.ap-northeast-1.amazonaws.com';
      const dashboardUrl = `${s3BaseUrl}/dashboard.html?weekId=${weekId}`;

      let message: string;
      if (changes || isNewEntry) {
        // 新規入力または変更がある場合
        message = buildNotificationMessage(displayName, dashboardUrl);
      } else {
        // 変更なしの場合は通知しない
        message = '';
      }

      if (message) {
        await pushMessage(config.groupId, message, credentials.channelAccessToken);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Success' })
    };
  } catch (error) {
    console.error('Schedule submit error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

/**
 * 通知メッセージを生成
 */
function buildNotificationMessage(displayName: string, dashboardUrl: string): string {
  return `来週の予定を${displayName}さんが更新しました。\n\n▼修正する場合はこちら\n${dashboardUrl}`;
}


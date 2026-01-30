/**
 * GET /history
 * 週別履歴とポイントを取得
 * WeeklyFinalizedとScheduleInputsの両方から週リストを取得
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, ScanCommandOutput } from '@aws-sdk/lib-dynamodb';
import { generateNextWeekId } from '../utils/weekId';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  weeklyFinalized: process.env.TABLE_WEEKLY_FINALIZED || 'WeeklyFinalized-kame',
  scheduleInputs: process.env.TABLE_SCHEDULE_INPUTS || 'ScheduleInputs-kame'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

interface CumulativePoint {
  userId: string;
  displayName: string;
  totalPoints: number;
  weekdayPoints: number;
  weekendBonusPoints: number;
}

/**
 * WeeklyFinalizedテーブルから全件取得（ページネーション対応）
 */
async function scanAllWeeklyFinalized(): Promise<any[]> {
  const items: any[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;

  do {
    const result: ScanCommandOutput = await docClient.send(new ScanCommand({
      TableName: TABLES.weeklyFinalized,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: { ':sk': 'FINALIZED' },
      ExclusiveStartKey: lastEvaluatedKey
    }));

    items.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * ScheduleInputsテーブルからユニークなweekIdを取得
 */
async function getWeekIdsFromScheduleInputs(): Promise<string[]> {
  const weekIds = new Set<string>();
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;

  do {
    const result: ScanCommandOutput = await docClient.send(new ScanCommand({
      TableName: TABLES.scheduleInputs,
      ProjectionExpression: 'weekId',
      ExclusiveStartKey: lastEvaluatedKey
    }));

    for (const item of result.Items || []) {
      if (item.weekId) {
        weekIds.add(item.weekId as string);
      }
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return Array.from(weekIds);
}

/**
 * 週別履歴から累計ポイントを計算
 */
function calculateCumulativeFromHistory(weeklyHistory: any[]): CumulativePoint[] {
  const userTotals: Map<string, CumulativePoint> = new Map();

  for (const week of weeklyHistory) {
    if (!week.pointsBreakdown) continue;
    for (const [userId, points] of Object.entries(week.pointsBreakdown)) {
      const p = points as any;
      const existing = userTotals.get(userId) || {
        userId,
        displayName: p.displayName,
        totalPoints: 0,
        weekdayPoints: 0,
        weekendBonusPoints: 0
      };
      existing.totalPoints += p.totalPoints || 0;
      existing.weekdayPoints += p.weekdayPoints || 0;
      existing.weekendBonusPoints += p.weekendBonusPoints || 0;
      userTotals.set(userId, existing);
    }
  }

  return Array.from(userTotals.values());
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

    // 週次確定データを全件取得（ページネーション対応）
    const finalizedItems = await scanAllWeeklyFinalized();
    const finalizedMap = new Map<string, any>();
    for (const item of finalizedItems) {
      finalizedMap.set(item.weekId, item);
    }

    // ScheduleInputsから全weekIdを取得
    const inputWeekIds = await getWeekIdsFromScheduleInputs();

    // 全weekIdをマージ（確定データがない週も含める）
    const allWeekIds = new Set<string>([
      ...finalizedMap.keys(),
      ...inputWeekIds
    ]);

    // 現在集計中の週を除外（未来の週は除外しない）
    const currentInputWeekId = generateNextWeekId();

    // 週リストを作成（確定データがあれば使用、なければ入力データありとマーク）
    const weeklyHistory = Array.from(allWeekIds)
      .filter(weekId => weekId !== currentInputWeekId)
      .filter(weekId => weekId >= '2025-12-29') // 12/29以降のみ
      .sort((a, b) => b.localeCompare(a))
      .map(weekId => {
        const finalized = finalizedMap.get(weekId);
        if (finalized) {
          return {
            weekId: finalized.weekId,
            finalizedAt: finalized.finalizedAt,
            pointsBreakdown: finalized.pointsBreakdown,
            scheduleText: finalized.scheduleText,
            isFinalized: true
          };
        } else {
          return {
            weekId,
            finalizedAt: null,
            pointsBreakdown: null,
            scheduleText: null,
            isFinalized: false
          };
        }
      });

    // 累計ポイントはWeeklyFinalizedからのみ計算（確定データのみ）
    const finalizedHistory = weeklyHistory.filter(w => w.isFinalized);
    const cumulativePoints = calculateCumulativeFromHistory(finalizedHistory);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        weeklyHistory,
        cumulativePoints
      })
    };
  } catch (error: any) {
    console.error('History get error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};

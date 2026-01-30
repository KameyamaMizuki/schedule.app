/**
 * 特定週の確定データを手動生成するスクリプト
 * Usage: npx ts-node scripts/finalize-week.ts 2026-01-05
 */

import { DynamoDB } from 'aws-sdk';
import { calculateAllPoints } from '../src/utils/points';
import { buildFinalizedSchedule, ScheduleInputForText } from '../src/utils/scheduleText';
import { getWeekInfo } from '../src/utils/weekId';

const dynamodb = new DynamoDB.DocumentClient({ region: 'ap-northeast-1' });

const TABLE_SCHEDULE_INPUTS = 'ScheduleInputs-kame';
const TABLE_WEEKLY_FINALIZED = 'WeeklyFinalized-kame';

async function getAllScheduleInputs(weekId: string): Promise<ScheduleInputForText[]> {
  const result = await dynamodb.query({
    TableName: TABLE_SCHEDULE_INPUTS,
    KeyConditionExpression: 'weekId = :weekId',
    ExpressionAttributeValues: { ':weekId': weekId }
  }).promise();

  return (result.Items || []) as ScheduleInputForText[];
}

async function finalizeWeek(weekId: string): Promise<void> {
  console.log(`Processing weekId: ${weekId}`);

  // 既に確定済みかチェック
  const existing = await dynamodb.get({
    TableName: TABLE_WEEKLY_FINALIZED,
    Key: { weekId, SK: 'FINALIZED' }
  }).promise();

  if (existing.Item) {
    console.log(`Week ${weekId} is already finalized. Updating...`);
  }

  // 入力データ取得
  const inputs = await getAllScheduleInputs(weekId);

  if (inputs.length === 0) {
    console.log(`No inputs found for weekId: ${weekId}`);
    return;
  }

  console.log(`Found ${inputs.length} inputs`);

  // ポイント計算
  const pointsBreakdown = calculateAllPoints(inputs);
  console.log('Points breakdown:', JSON.stringify(pointsBreakdown, null, 2));

  // 週情報取得
  const weekInfo = getWeekInfo(weekId);

  // 確定表テキスト生成（共通ユーティリティ使用）
  const scheduleText = buildFinalizedSchedule(weekInfo.dates, inputs, pointsBreakdown);

  // TTL設定（90日後）
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

  // 保存
  await dynamodb.put({
    TableName: TABLE_WEEKLY_FINALIZED,
    Item: {
      weekId,
      SK: 'FINALIZED',
      finalizedAt: new Date().toISOString(),
      scheduleText,
      pointsBreakdown,
      ttl,
      version: existing.Item ? (existing.Item.version || 0) + 1 : 0
    }
  }).promise();

  console.log(`Week ${weekId} finalized successfully!`);
  console.log('\n--- Generated Schedule Text ---');
  console.log(scheduleText);
}

async function main() {
  const weekId = process.argv[2];

  if (!weekId) {
    console.error('Usage: npx ts-node scripts/finalize-week.ts YYYY-MM-DD');
    process.exit(1);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekId)) {
    console.error('Invalid weekId format. Expected YYYY-MM-DD');
    process.exit(1);
  }

  await finalizeWeek(weekId);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

/**
 * 未確定週を確定するスクリプト
 * ScheduleInputsにデータがあるが、WeeklyFinalizedにない週を確定
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';
import { calculatePoints } from '../src/utils/points';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  credentials: fromSSO({ profile: process.env.AWS_PROFILE || 'c3test' })
});
const docClient = DynamoDBDocumentClient.from(client);

const INPUTS_TABLE = 'ScheduleInputs-kame';
const FINALIZED_TABLE = 'WeeklyFinalized-kame';

interface ScheduleInput {
  weekId: string;
  userId: string;
  displayName: string;
  slots: { [key: string]: boolean };
  notes?: { [key: string]: string };
}

async function getAllInputWeeks(): Promise<string[]> {
  const weekIds = new Set<string>();
  let lastKey: Record<string, any> | undefined = undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result: any = await docClient.send(new ScanCommand({
      TableName: INPUTS_TABLE,
      ProjectionExpression: 'weekId',
      ExclusiveStartKey: lastKey
    }));

    for (const item of result.Items || []) {
      weekIds.add(item.weekId);
    }

    lastKey = result.LastEvaluatedKey;
    if (!lastKey) break;
  }

  return Array.from(weekIds).sort();
}

async function getFinalizedWeeks(): Promise<Set<string>> {
  const weekIds = new Set<string>();
  let lastKey: Record<string, any> | undefined = undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result: any = await docClient.send(new ScanCommand({
      TableName: FINALIZED_TABLE,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: { ':sk': 'FINALIZED' },
      ProjectionExpression: 'weekId',
      ExclusiveStartKey: lastKey
    }));

    for (const item of result.Items || []) {
      weekIds.add(item.weekId);
    }

    lastKey = result.LastEvaluatedKey;
    if (!lastKey) break;
  }

  return weekIds;
}

async function getInputsForWeek(weekId: string): Promise<ScheduleInput[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: INPUTS_TABLE,
    KeyConditionExpression: 'weekId = :wk',
    ExpressionAttributeValues: { ':wk': weekId }
  }));
  return (result.Items || []) as ScheduleInput[];
}

async function finalizeWeek(weekId: string, inputs: ScheduleInput[]) {
  // ポイント計算
  const pointsBreakdown: { [userId: string]: any } = {};
  for (const input of inputs) {
    const points = calculatePoints(input.slots);
    pointsBreakdown[input.userId] = {
      ...points,
      displayName: input.displayName
    };
  }

  // 確定データ保存
  await docClient.send(new PutCommand({
    TableName: FINALIZED_TABLE,
    Item: {
      weekId,
      SK: 'FINALIZED',
      finalizedAt: new Date().toISOString(),
      pointsBreakdown,
      version: 0
    }
  }));

  return pointsBreakdown;
}

async function main() {
  console.log('=== 未確定週の確定処理 ===\n');

  // 今日の日付（JST）を取得
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const todayStr = jstNow.toISOString().split('T')[0];
  console.log('今日の日付 (JST):', todayStr);

  // 全入力がある週を取得
  const inputWeeks = await getAllInputWeeks();
  console.log('入力がある週:', inputWeeks);

  // 確定済み週を取得
  const finalizedWeeks = await getFinalizedWeeks();
  console.log('確定済み週:', Array.from(finalizedWeeks));

  // 未確定週を特定（その週の月曜0:00以降なら確定対象）
  // 月曜0:00に今週を確定するロジック
  const missingWeeks: string[] = [];
  for (const weekId of inputWeeks) {
    if (finalizedWeeks.has(weekId)) continue;

    // 確定判定: weekIdの月曜0:00を過ぎていれば確定対象
    // 例: 1/19週 → 1/19 0:00以降なら確定対象
    if (todayStr >= weekId) {
      missingWeeks.push(weekId);
    } else {
      console.log(`${weekId}: まだ確定時刻前（月曜0:00: ${weekId}）`);
    }
  }

  console.log('\n確定すべき週:', missingWeeks);

  if (missingWeeks.length === 0) {
    console.log('\n未確定の週はありません。');
    return;
  }

  // 確定処理
  for (const weekId of missingWeeks) {
    console.log(`\n--- ${weekId} の確定処理 ---`);

    const inputs = await getInputsForWeek(weekId);
    console.log(`入力数: ${inputs.length}`);

    if (inputs.length === 0) {
      console.log('入力なし。スキップ。');
      continue;
    }

    const pointsBreakdown = await finalizeWeek(weekId, inputs);
    console.log('確定完了:');
    for (const [userId, points] of Object.entries(pointsBreakdown)) {
      const p = points as any;
      console.log(`  ${p.displayName}: 平日=${p.weekdayPoints}, 土日加算=${p.weekendBonusPoints}, 合計=${p.totalPoints}`);
    }
  }

  console.log('\n=== 処理完了 ===');
}

main().catch(console.error);

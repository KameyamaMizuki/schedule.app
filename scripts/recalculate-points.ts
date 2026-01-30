/**
 * 既存のWeeklyFinalizedデータのポイントを再計算するスクリプト
 * 土日判定の修正後、既存データを正しいポイントに更新
 */

import { calculatePoints } from '../src/utils/points';

// AWS SDK v3 を使用
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  credentials: fromSSO({ profile: process.env.AWS_PROFILE || 'c3test' })
});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'WeeklyFinalized-kame';
const INPUTS_TABLE = 'ScheduleInputs-kame';

interface ScheduleInput {
  PK: string;
  SK: string;
  userId: string;
  weekId: string;
  displayName: string;
  slots: { [key: string]: boolean };
  notes: { [key: string]: string };
}

async function getScheduleInputsForWeek(weekId: string): Promise<ScheduleInput[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: INPUTS_TABLE,
    KeyConditionExpression: 'weekId = :wk',
    ExpressionAttributeValues: {
      ':wk': weekId
    }
  }));
  return (result.Items || []) as ScheduleInput[];
}

async function getAllFinalizedWeeks(): Promise<any[]> {
  const items: any[] = [];
  let lastKey: Record<string, any> | undefined = undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const scanResult: any = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: { ':sk': 'FINALIZED' },
      ExclusiveStartKey: lastKey
    }));

    items.push(...(scanResult.Items || []));
    lastKey = scanResult.LastEvaluatedKey;
    if (!lastKey) break;
  }

  return items;
}

async function recalculateAndUpdate() {
  console.log('=== ポイント再計算スクリプト ===\n');

  // 1. 全ての確定済み週を取得
  const finalizedWeeks = await getAllFinalizedWeeks();
  console.log(`確定済み週: ${finalizedWeeks.length}件\n`);

  for (const week of finalizedWeeks) {
    console.log(`\n--- ${week.weekId} ---`);
    console.log('現在のpointsBreakdown:');
    console.log(JSON.stringify(week.pointsBreakdown, null, 2));

    // 2. その週のScheduleInputsを取得
    const inputs = await getScheduleInputsForWeek(week.weekId);
    if (inputs.length === 0) {
      console.log('ScheduleInputsが見つかりません。スキップします。');
      continue;
    }

    // 3. ポイント再計算
    const newPointsBreakdown: { [userId: string]: any } = {};
    for (const input of inputs) {
      const points = calculatePoints(input.slots);
      newPointsBreakdown[input.userId] = {
        ...points,
        displayName: input.displayName
      };
    }

    console.log('\n再計算後のpointsBreakdown:');
    console.log(JSON.stringify(newPointsBreakdown, null, 2));

    // 4. 差分を表示
    console.log('\n差分:');
    for (const [userId, newPoints] of Object.entries(newPointsBreakdown)) {
      const oldPoints = week.pointsBreakdown?.[userId];
      if (oldPoints) {
        const np = newPoints as any;
        const weekdayDiff = np.weekdayPoints - oldPoints.weekdayPoints;
        const weekendDiff = np.weekendBonusPoints - oldPoints.weekendBonusPoints;
        const totalDiff = np.totalPoints - oldPoints.totalPoints;
        if (weekdayDiff !== 0 || weekendDiff !== 0 || totalDiff !== 0) {
          console.log(`  ${np.displayName}: 平日 ${oldPoints.weekdayPoints}→${np.weekdayPoints} (${weekdayDiff > 0 ? '+' : ''}${weekdayDiff}), 土日加算 ${oldPoints.weekendBonusPoints}→${np.weekendBonusPoints} (${weekendDiff > 0 ? '+' : ''}${weekendDiff}), 合計 ${oldPoints.totalPoints}→${np.totalPoints} (${totalDiff > 0 ? '+' : ''}${totalDiff})`);
        } else {
          console.log(`  ${np.displayName}: 変更なし`);
        }
      }
    }

    // 5. DynamoDBを更新
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        weekId: week.weekId,
        SK: 'FINALIZED'
      },
      UpdateExpression: 'SET pointsBreakdown = :pb',
      ExpressionAttributeValues: {
        ':pb': newPointsBreakdown
      }
    }));
    console.log('✓ 更新完了');
  }

  console.log('\n=== 再計算完了 ===');
}

recalculateAndUpdate().catch(console.error);

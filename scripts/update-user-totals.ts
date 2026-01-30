/**
 * UserPointsテーブルの累計を再計算・更新するスクリプト
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  credentials: fromSSO({ profile: process.env.AWS_PROFILE || 'c3test' })
});
const docClient = DynamoDBDocumentClient.from(client);

interface PointsData {
  displayName: string;
  weekdayPoints: number;
  weekendBonusPoints: number;
  totalPoints: number;
}

async function updateUserTotals() {
  console.log('=== UserPoints累計更新スクリプト ===\n');

  // 全ての確定済み週を取得
  const scanResult = await docClient.send(new ScanCommand({
    TableName: 'WeeklyFinalized-kame',
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'FINALIZED' }
  }));

  const weeks = scanResult.Items || [];
  console.log('確定済み週数:', weeks.length);

  // 累計計算用
  const totals: { [userId: string]: PointsData } = {};
  let latestWeek = '';

  // 週をソート
  const sortedWeeks = weeks.sort((a: any, b: any) => a.weekId.localeCompare(b.weekId));

  for (const week of sortedWeeks) {
    const pb = week.pointsBreakdown || {};
    latestWeek = week.weekId;

    for (const [userId, points] of Object.entries(pb)) {
      const p = points as PointsData;
      if (!totals[userId]) {
        totals[userId] = { displayName: p.displayName, weekdayPoints: 0, weekendBonusPoints: 0, totalPoints: 0 };
      }
      totals[userId].weekdayPoints += p.weekdayPoints;
      totals[userId].weekendBonusPoints += p.weekendBonusPoints;
      totals[userId].totalPoints += p.totalPoints;
    }
  }

  console.log('最新確定週:', latestWeek);
  console.log('\n累計値:');

  // UserPointsテーブルを更新
  for (const [userId, t] of Object.entries(totals)) {
    console.log(`  ${t.displayName}: 平日=${t.weekdayPoints}, 土日加算=${t.weekendBonusPoints}, 合計=${t.totalPoints}`);

    await docClient.send(new PutCommand({
      TableName: 'UserPoints-kame',
      Item: {
        userId,
        SK: 'TOTAL',
        displayName: t.displayName,
        weekdayPoints: t.weekdayPoints,
        weekendBonusPoints: t.weekendBonusPoints,
        totalPoints: t.totalPoints,
        lastUpdatedWeek: latestWeek,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  console.log('\n✓ UserPointsテーブル更新完了');
}

updateUserTotals().catch(console.error);

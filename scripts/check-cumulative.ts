/**
 * 累計データ確認スクリプト
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
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

async function checkData() {
  // 全ての確定済み週を取得
  const scanResult = await docClient.send(new ScanCommand({
    TableName: 'WeeklyFinalized-kame',
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'FINALIZED' }
  }));

  const weeks = scanResult.Items || [];
  console.log('=== 確定済み週一覧 ===');
  console.log('週数:', weeks.length);

  // 累計計算用
  const totals: { [userId: string]: PointsData } = {};

  // 週をソートして表示
  const sortedWeeks = weeks.sort((a: any, b: any) => a.weekId.localeCompare(b.weekId));

  for (const week of sortedWeeks) {
    console.log('\n--- ' + week.weekId + ' ---');
    const pb = week.pointsBreakdown || {};
    for (const [userId, points] of Object.entries(pb)) {
      const p = points as PointsData;
      console.log(`  ${p.displayName}: 平日=${p.weekdayPoints}, 土日加算=${p.weekendBonusPoints}, 合計=${p.totalPoints}`);

      if (!totals[userId]) {
        totals[userId] = { displayName: p.displayName, weekdayPoints: 0, weekendBonusPoints: 0, totalPoints: 0 };
      }
      totals[userId].weekdayPoints += p.weekdayPoints;
      totals[userId].weekendBonusPoints += p.weekendBonusPoints;
      totals[userId].totalPoints += p.totalPoints;
    }
  }

  console.log('\n=== 累計（計算値） ===');
  for (const [userId, t] of Object.entries(totals)) {
    console.log(`${t.displayName}: 平日=${t.weekdayPoints}, 土日加算=${t.weekendBonusPoints}, 合計=${t.totalPoints}`);
  }
}

checkData().catch(console.error);

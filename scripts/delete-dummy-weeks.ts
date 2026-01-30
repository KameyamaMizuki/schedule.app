/**
 * ダミー週データを削除するスクリプト
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  credentials: fromSSO({ profile: process.env.AWS_PROFILE || 'c3test' })
});
const docClient = DynamoDBDocumentClient.from(client);

const INPUTS_TABLE = 'ScheduleInputs-kame';
const FINALIZED_TABLE = 'WeeklyFinalized-kame';

const WEEKS_TO_DELETE = ['2025-12-16', '2025-12-23'];

async function deleteWeekData(weekId: string) {
  console.log(`\n=== ${weekId} を削除 ===`);

  // 1. ScheduleInputsから削除
  const inputs = await docClient.send(new QueryCommand({
    TableName: INPUTS_TABLE,
    KeyConditionExpression: 'weekId = :wk',
    ExpressionAttributeValues: { ':wk': weekId }
  }));

  for (const item of inputs.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: INPUTS_TABLE,
      Key: { weekId: item.weekId, userId: item.userId }
    }));
    console.log(`  ScheduleInputs削除: ${item.displayName || item.userId}`);
  }

  // 2. WeeklyFinalizedから削除
  await docClient.send(new DeleteCommand({
    TableName: FINALIZED_TABLE,
    Key: { weekId, SK: 'FINALIZED' }
  }));
  console.log(`  WeeklyFinalized削除: ${weekId}`);
}

async function main() {
  console.log('=== ダミー週データ削除 ===');
  console.log('削除対象:', WEEKS_TO_DELETE);

  for (const weekId of WEEKS_TO_DELETE) {
    await deleteWeekData(weekId);
  }

  console.log('\n=== 削除完了 ===');
}

main().catch(console.error);

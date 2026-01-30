/**
 * ChirolData-kame テーブル作成スクリプト
 */

import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  credentials: fromSSO({ profile: process.env.AWS_PROFILE || 'c3test' })
});

const TABLE_NAME = 'ChirolData-kame';

async function createTable() {
  console.log(`=== ${TABLE_NAME} テーブル作成 ===\n`);

  // まず既存テーブルを確認
  try {
    const describeResult = await client.send(new DescribeTableCommand({
      TableName: TABLE_NAME
    }));
    console.log('テーブルは既に存在します:', describeResult.Table?.TableStatus);
    return;
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
    console.log('テーブルが存在しないため作成します...');
  }

  // テーブル作成
  await client.send(new CreateTableCommand({
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }));

  console.log('✓ テーブル作成完了');
  console.log('\nテーブル構造:');
  console.log('  PK: CHIROL (固定)');
  console.log('  SK: HITOKOTO#<id> | IMAGE#<id>');
  console.log('\n一言データ:');
  console.log('  { PK, SK, hitokotoId, text, createdAt }');
  console.log('\n画像データ:');
  console.log('  { PK, SK, imageId, imageUrl, s3Key, tag, createdAt }');
}

createTable().catch(console.error);

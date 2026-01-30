/**
 * GET /medications
 * 薬リスト取得API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_MEDICATIONS || 'MedicationSchedule-kame';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

// 時間帯の定義
const TIME_PERIODS = ['朝', '昼', '夜', '寝る前'];

// デフォルトの薬リスト（10種類）
const DEFAULT_MEDICATIONS = [
  { name: '薬1', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬2', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬3', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬4', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬5', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬6', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬7', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬8', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬9', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } },
  { name: '薬10', periods: { '朝': false, '昼': false, '夜': false, '寝る前': false } }
];

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // 薬リストを取得
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: 'MEDS' }
    }));

    if (result.Item) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          medications: result.Item.medications,
          timePeriods: TIME_PERIODS
        })
      };
    }

    // 初回アクセス時はデフォルトを作成
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: 'MEDS',
        medications: DEFAULT_MEDICATIONS,
        updatedAt: new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        medications: DEFAULT_MEDICATIONS,
        timePeriods: TIME_PERIODS
      })
    };

  } catch (error) {
    console.error('Medication get error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '薬リストの取得に失敗しました' })
    };
  }
};

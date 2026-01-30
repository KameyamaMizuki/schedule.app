/**
 * POST /records
 * 犬の記録保存API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_DOG_RECORDS || 'DogRecords-kame';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

interface RecordRequest {
  recordDate: string;      // YYYY-MM-DD
  time: string;            // HH:mm
  condition?: string;      // 様子（自由記述）
  meal?: string;           // 食事（自由記述）
  toilet?: string;         // トイレ（自由記述）
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    const body: RecordRequest = JSON.parse(event.body || '{}');
    const { recordDate, time, condition, meal, toilet } = body;

    if (!recordDate || !time) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: '日付と時間は必須です' })
      };
    }

    // 少なくとも1つの記録項目が必要
    if (!condition && !meal && !toilet) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: '様子、食事、トイレのいずれかを入力してください' })
      };
    }

    const recordId = `${time.replace(':', '')}-${Date.now()}`;
    const createdAt = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        recordDate,
        recordId,
        time,
        condition: condition || '',
        meal: meal || '',
        toilet: toilet || '',
        createdAt
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: '保存しました',
        recordId,
        recordDate,
        time
      })
    };
  } catch (error) {
    console.error('Record save error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '保存に失敗しました' })
    };
  }
};

/**
 * GET /records/{date}
 * GET /records?start={date}&end={date}
 * 犬の記録取得API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_DOG_RECORDS || 'DogRecords-kame';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

interface DogRecord {
  recordDate: string;
  recordId: string;
  time: string;
  condition: string;
  meal: string;
  toilet: string;
  createdAt: string;
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

    const date = event.pathParameters?.date;
    const startDate = event.queryStringParameters?.start;
    const endDate = event.queryStringParameters?.end;

    // 単一日付の記録取得
    if (date) {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'recordDate = :date',
        ExpressionAttributeValues: {
          ':date': date
        },
        ScanIndexForward: true  // 時間順
      }));

      const records = (result.Items || []) as DogRecord[];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          date,
          records: records.sort((a, b) => a.time.localeCompare(b.time))
        })
      };
    }

    // 期間指定の記録取得（カレンダー表示用）
    if (startDate && endDate) {
      const dates = getDateRange(startDate, endDate);

      // 記録がある日付のみを取得（BatchGet）
      const recordsByDate: { [date: string]: DogRecord[] } = {};

      // 各日付について記録を取得
      for (const d of dates) {
        const result = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'recordDate = :date',
          ExpressionAttributeValues: {
            ':date': d
          }
        }));

        if (result.Items && result.Items.length > 0) {
          recordsByDate[d] = result.Items as DogRecord[];
        }
      }

      // 記録がある日付一覧
      const datesWithRecords = Object.keys(recordsByDate);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          startDate,
          endDate,
          datesWithRecords,
          recordsByDate
        })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: '日付を指定してください' })
    };

  } catch (error) {
    console.error('Record get error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '取得に失敗しました' })
    };
  }
};

/**
 * 日付範囲を配列で取得
 */
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startDate = new Date(start + 'T00:00:00+09:00');
  const endDate = new Date(end + 'T00:00:00+09:00');

  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

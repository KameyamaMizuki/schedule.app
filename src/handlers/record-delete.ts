/**
 * DELETE /records/{date}/{recordId}
 * 犬の記録削除API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_DOG_RECORDS || 'DogRecords-kame';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
};

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
    const recordId = event.pathParameters?.recordId;

    if (!date || !recordId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: '日付と記録IDが必要です' })
      };
    }

    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        recordDate: date,
        recordId: recordId
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: '削除しました' })
    };
  } catch (error) {
    console.error('Record delete error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '削除に失敗しました' })
    };
  }
};

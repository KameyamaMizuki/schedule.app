/**
 * PUT /medications
 * 薬リスト更新API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_MEDICATIONS || 'MedicationSchedule-kame';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS'
};

interface Medication {
  name: string;
  periods: {
    '朝': boolean;
    '昼': boolean;
    '夜': boolean;
    '寝る前': boolean;
  };
}

interface MedicationSaveRequest {
  medications: Medication[];
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

    const body: MedicationSaveRequest = JSON.parse(event.body || '{}');
    const { medications } = body;

    if (!medications || !Array.isArray(medications)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: '薬リストが必要です' })
      };
    }

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: 'MEDS',
        medications,
        updatedAt: new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: '保存しました' })
    };

  } catch (error) {
    console.error('Medication save error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '薬リストの保存に失敗しました' })
    };
  }
};

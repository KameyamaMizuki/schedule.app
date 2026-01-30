/**
 * チロルの一言 保存/取得 Lambda
 *
 * GET /chirol/hitokoto - 全ての一言を取得
 * POST /chirol/hitokoto - 新しい一言を追加
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_CHIROL_DATA || 'ChirolData-kame';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
};

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await getHitokotoList();
    } else if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await addHitokoto(body.text);
    } else if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      return await deleteHitokoto(body.hitokotoId);
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function getHitokotoList() {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'HITOKOTO#' }
  }));

  const items = (result.Items || []).map(item => ({
    id: item.hitokotoId,
    text: item.text,
    createdAt: item.createdAt
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ hitokotoList: items })
  };
}

async function addHitokoto(text: string) {
  if (!text || text.trim().length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Text is required' })
    };
  }

  const hitokotoId = `hitokoto_${Date.now()}`;
  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: 'CHIROL',
      SK: `HITOKOTO#${hitokotoId}`,
      hitokotoId,
      text: text.trim(),
      createdAt: now
    }
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      hitokotoId,
      message: '追加したぜ。'
    })
  };
}

async function deleteHitokoto(hitokotoId: string) {
  if (!hitokotoId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'hitokotoId is required' })
    };
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: 'CHIROL',
      SK: `HITOKOTO#${hitokotoId}`
    }
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true })
  };
}

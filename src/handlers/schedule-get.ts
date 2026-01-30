/**
 * GET /schedule/{weekId}
 * LIFF取得API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { ScheduleGetResponse } from '../types';
import { getScheduleInput } from '../utils/dynamodb';
import { getWeekInfo } from '../utils/weekId';
import { getLineCredentials } from '../utils/secrets';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // CORS対応
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    const weekId = event.pathParameters?.weekId || '';
    const userId = event.queryStringParameters?.userId || '';

    if (!weekId || !userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing weekId or userId' })
      };
    }

    // 週情報取得
    const weekInfo = getWeekInfo(weekId);

    // 管理者チェック
    const credentials = await getLineCredentials();
    const isAdmin = userId === credentials.adminUserId;

    // 自分の入力取得
    const input = await getScheduleInput(weekId, userId);

    const response: ScheduleGetResponse = {
      weekId,
      startDate: weekInfo.startDate,
      endDate: weekInfo.endDate,
      deadline: weekInfo.deadline,
      isLocked: false,
      slots: input?.slots || {},
      notes: input?.notes || {},
      isAdmin
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Schedule get error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};


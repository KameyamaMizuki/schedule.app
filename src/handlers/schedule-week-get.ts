/**
 * GET /schedule/week/{weekId}
 * 週ごとの全ユーザーデータ取得API（ダッシュボード最適化用）
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { getAllScheduleInputs } from '../utils/dynamodb';
import { getWeekInfo } from '../utils/weekId';

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

    if (!weekId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing weekId' })
      };
    }

    // 週情報取得
    const weekInfo = getWeekInfo(weekId);

    // 全ユーザーの入力を一度に取得
    const inputs = await getAllScheduleInputs(weekId);

    const response = {
      weekId,
      startDate: weekInfo.startDate,
      endDate: weekInfo.endDate,
      deadline: weekInfo.deadline,
      dates: weekInfo.dates,
      isLocked: false,
      users: inputs.map(input => ({
        userId: input.userId,
        displayName: input.displayName,
        slots: input.slots || {},
        notes: input.notes || {},
        submittedAt: input.submittedAt
      }))
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Schedule week get error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

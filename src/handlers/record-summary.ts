/**
 * POST /records/summary
 * 期間指定で記録を要約するAPI（獣医さんへの説明用）
 * Bedrock Claude を使用
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' });

const TABLE_NAME = process.env.TABLE_DOG_RECORDS || 'DogRecords-kame';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
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

interface SummaryRequest {
  startDate: string;
  endDate: string;
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

    const body: SummaryRequest = JSON.parse(event.body || '{}');
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: '開始日と終了日を指定してください' })
      };
    }

    // 期間内の記録を取得
    const dates = getDateRange(startDate, endDate);
    const allRecords: DogRecord[] = [];

    for (const date of dates) {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'recordDate = :date',
        ExpressionAttributeValues: {
          ':date': date
        }
      }));

      if (result.Items) {
        allRecords.push(...(result.Items as DogRecord[]));
      }
    }

    if (allRecords.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          summary: 'この期間には記録がありません。',
          recordCount: 0
        })
      };
    }

    // 記録をテキスト形式に変換
    const recordsText = formatRecordsForAI(allRecords);

    // Bedrock Claude で要約
    const summary = await generateSummary(recordsText, startDate, endDate);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        summary,
        startDate,
        endDate,
        recordCount: allRecords.length
      })
    };

  } catch (error) {
    console.error('Record summary error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '要約の生成に失敗しました' })
    };
  }
};

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

function formatRecordsForAI(records: DogRecord[]): string {
  // 日付順にソート
  const sorted = records.sort((a, b) => {
    const dateCompare = a.recordDate.localeCompare(b.recordDate);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  const lines: string[] = [];
  let currentDate = '';

  for (const record of sorted) {
    if (record.recordDate !== currentDate) {
      currentDate = record.recordDate;
      lines.push(`\n【${currentDate}】`);
    }

    const parts: string[] = [`${record.time}`];
    if (record.condition) parts.push(`様子: ${record.condition}`);
    if (record.meal) parts.push(`食事: ${record.meal}`);
    if (record.toilet) parts.push(`トイレ: ${record.toilet}`);

    lines.push(parts.join(' / '));
  }

  return lines.join('\n');
}

async function generateSummary(recordsText: string, startDate: string, endDate: string): Promise<string> {
  const prompt = `あなたは獣医師に犬の健康状態を説明するお手伝いをするアシスタントです。

以下は${startDate}から${endDate}までの犬の記録です。この記録を要約して、獣医師に伝えるべき重要なポイントを簡潔にまとめてください。

【記録データ】
${recordsText}

【要約のポイント】
- 食欲の変化や傾向
- 排泄の状態や異常
- 様子の変化（元気、調子など）
- 気になる症状があれば強調
- 日本語で、獣医師に伝えやすい形式で

要約:`;

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  }));

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}

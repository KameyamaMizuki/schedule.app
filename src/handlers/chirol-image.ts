/**
 * チロルの画像 アップロード/取得 Lambda
 *
 * GET /chirol/images - 画像一覧取得
 * POST /chirol/images - 新しい画像をアップロード
 *
 * 画像はS3に保存、メタデータはDynamoDBに保存
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.TABLE_CHIROL_DATA || 'ChirolData-kame';
const BUCKET_NAME = process.env.CHIROL_IMAGE_BUCKET || 'family-schedule-web-kame-982312822872';
const IMAGE_PREFIX = 'chirol-images/';

// 画像サイズ設定
const IMAGE_SIZE = 400; // 400x400px

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
};

type ImageTag = 'normal' | 'happy' | 'thinking' | 'sad';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const tag = event.queryStringParameters?.tag as ImageTag | undefined;
      return await getImageList(tag);
    } else if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await uploadImage(body.imageData, body.tag);
    } else if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      return await deleteImage(body.imageId);
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
      body: JSON.stringify({ error: 'Internal server error', details: String(error) })
    };
  }
};

async function getImageList(tag?: ImageTag) {
  let filterExpression = 'begins_with(SK, :prefix)';
  const expressionValues: Record<string, string> = { ':prefix': 'IMAGE#' };

  if (tag) {
    filterExpression += ' AND tag = :tag';
    expressionValues[':tag'] = tag;
  }

  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionValues
  }));

  const items = (result.Items || []).map(item => ({
    id: item.imageId,
    url: item.imageUrl,
    tag: item.tag,
    createdAt: item.createdAt
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ images: items })
  };
}

async function uploadImage(imageData: string, tag: ImageTag) {
  if (!imageData) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'imageData is required' })
    };
  }

  if (!tag || !['normal', 'happy', 'thinking', 'sad'].includes(tag)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Valid tag is required (normal/happy/thinking/sad)' })
    };
  }

  // Base64デコード
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  // sharpで正方形にリサイズ＆最適化
  const optimizedBuffer = await sharp(imageBuffer)
    .resize(IMAGE_SIZE, IMAGE_SIZE, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  const imageId = `img_${Date.now()}`;
  const fileName = `${IMAGE_PREFIX}${tag}/${imageId}.jpg`;
  const now = new Date().toISOString();

  // S3にアップロード
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: optimizedBuffer,
    ContentType: 'image/jpeg',
    CacheControl: 'max-age=31536000'
  }));

  const imageUrl = `https://${BUCKET_NAME}.s3.ap-northeast-1.amazonaws.com/${fileName}`;

  // DynamoDBにメタデータ保存
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: 'CHIROL',
      SK: `IMAGE#${imageId}`,
      imageId,
      imageUrl,
      s3Key: fileName,
      tag,
      createdAt: now
    }
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      imageId,
      imageUrl,
      message: '追加したぜ。'
    })
  };
}

async function deleteImage(imageId: string) {
  if (!imageId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'imageId is required' })
    };
  }

  // まずメタデータを取得してS3キーを確認
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'imageId = :id',
    ExpressionAttributeValues: { ':id': imageId }
  }));

  if (!result.Items || result.Items.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Image not found' })
    };
  }

  const item = result.Items[0];

  // S3から削除
  if (item.s3Key) {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: item.s3Key
    }));
  }

  // DynamoDBから削除
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: 'CHIROL',
      SK: `IMAGE#${imageId}#DELETED`,
      deletedAt: new Date().toISOString()
    }
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true })
  };
}

/**
 * DynamoDB操作ユーティリティ
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
import {
  ScheduleInput,
  WeeklyFinalized,
  UserPoints,
  SystemConfig
} from '../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  scheduleInputs: process.env.TABLE_SCHEDULE_INPUTS || 'ScheduleInputs',
  weeklyFinalized: process.env.TABLE_WEEKLY_FINALIZED || 'WeeklyFinalized',
  userPoints: process.env.TABLE_USER_POINTS || 'UserPoints',
  systemConfig: process.env.TABLE_SYSTEM_CONFIG || 'SystemConfig'
};

// TTL: 12週間後
const getTTL = () => Math.floor(Date.now() / 1000) + (12 * 7 * 24 * 60 * 60);

/**
 * ScheduleInputs操作
 */
export async function saveScheduleInput(input: ScheduleInput): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLES.scheduleInputs,
    Item: {
      ...input,
      ttl: getTTL()
    }
  }));
}

export async function getScheduleInput(weekId: string, userId: string): Promise<ScheduleInput | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.scheduleInputs,
    Key: { weekId, userId }
  }));

  return result.Item as ScheduleInput || null;
}

export async function getAllScheduleInputs(weekId: string): Promise<ScheduleInput[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.scheduleInputs,
    KeyConditionExpression: 'weekId = :weekId',
    ExpressionAttributeValues: { ':weekId': weekId }
  }));

  return (result.Items as ScheduleInput[]) || [];
}

/**
 * WeeklyFinalized操作
 */
export async function saveWeeklyFinalized(finalized: WeeklyFinalized): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLES.weeklyFinalized,
    Item: {
      ...finalized,
      SK: 'FINALIZED',
      ttl: getTTL()
    }
  }));
}

export async function getWeeklyFinalized(weekId: string): Promise<WeeklyFinalized | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.weeklyFinalized,
    Key: { weekId, SK: 'FINALIZED' }
  }));

  return result.Item as WeeklyFinalized || null;
}

/**
 * UserPoints操作
 */
export async function getUserPoints(userId: string): Promise<UserPoints | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.userPoints,
    Key: { userId, SK: 'TOTAL' }
  }));

  return result.Item as UserPoints || null;
}

export async function updateUserPoints(points: UserPoints): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLES.userPoints,
    Item: {
      ...points,
      SK: 'TOTAL'
    }
  }));
}

export async function getAllUserPoints(): Promise<UserPoints[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLES.userPoints,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'TOTAL' }
  }));

  return (result.Items as UserPoints[]) || [];
}

/**
 * SystemConfig操作
 */
export async function getSystemConfig(): Promise<SystemConfig | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.systemConfig,
    Key: { PK: 'CONFIG', SK: 'MAIN' }
  }));

  return result.Item as SystemConfig || null;
}

export async function saveSystemConfig(config: SystemConfig): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLES.systemConfig,
    Item: {
      PK: 'CONFIG',
      SK: 'MAIN',
      ...config
    }
  }));
}

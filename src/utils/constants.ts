/**
 * アプリケーション全体で使用する定数
 */

/**
 * S3静的ウェブサイトのベースURL
 */
export const S3_BASE_URL = 'https://family-schedule-web-kame-982312822872.s3.ap-northeast-1.amazonaws.com';

/**
 * ダッシュボードURL生成
 */
export function getDashboardUrl(weekId?: string): string {
  return weekId
    ? `${S3_BASE_URL}/dashboard.html?weekId=${weekId}`
    : `${S3_BASE_URL}/dashboard.html`;
}

/**
 * 入力ページURL生成
 */
export function getInputUrl(weekId?: string, userId?: string, displayName?: string): string {
  const params = new URLSearchParams();
  if (weekId) params.append('weekId', weekId);
  if (userId) params.append('userId', userId);
  if (displayName) params.append('displayName', displayName);

  const queryString = params.toString();
  return queryString ? `${S3_BASE_URL}/index.html?${queryString}` : `${S3_BASE_URL}/index.html`;
}

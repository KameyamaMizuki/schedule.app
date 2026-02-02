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


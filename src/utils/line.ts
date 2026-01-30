/**
 * LINE API共通ユーティリティ
 */

/**
 * LINEグループにメッセージをプッシュ送信
 */
export async function pushMessage(
  groupId: string,
  text: string,
  channelAccessToken: string
): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to push message:', errorText);
    throw new Error(`Push message failed: ${errorText}`);
  }
}

import { appState } from '../state.js';

export async function sendWebhook({
  url,
  username,
  embed
}) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        embeds: [embed]
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('Webhook failed:', error.message);
    return null;
  }
}

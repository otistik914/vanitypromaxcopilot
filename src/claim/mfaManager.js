export class MFAManager {
  constructor({ logger }) {
    this.logger = logger;
    this.mfaToken = null;
    this.lastRefresh = 0;
    this.refreshInterval = 4 * 60 * 1000; // 4 minutes
    this.refreshTimer = null;
  }

  getToken() {
    if (!this.mfaToken) {
      throw new Error('MFA token not available');
    }
    return this.mfaToken;
  }

  isExpired() {
    return Date.now() - this.lastRefresh > this.refreshInterval;
  }

  async refresh({ httpClient, discordToken, password, guildId, logger }) {
    try {
      const start = Date.now();

      // Step 1: Trigger MFA
      const mfaReq = await httpClient.request({
        path: `/api/v9/guilds/${guildId}/vanity-url`,
        method: 'PATCH',
        headers: {
          'Authorization': discordToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: '' }),
        timeoutMs: 3000
      });

      if (mfaReq.status !== 401) {
        logger.info('MFA not needed');
        return true;
      }

      const mfaData = JSON.parse(mfaReq.body);
      if (!mfaData.mfa?.ticket) {
        throw new Error('No MFA ticket');
      }

      // Step 2: Solve MFA
      const mfaFinish = await httpClient.request({
        path: '/api/v9/mfa/finish',
        method: 'POST',
        headers: {
          'Authorization': discordToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket: mfaData.mfa.ticket,
          mfa_type: 'password',
          data: password
        }),
        timeoutMs: 3000
      });

      if (mfaFinish.status === 200) {
        const setCookies = mfaFinish.headers['set-cookie'] ?? [];
        for (const cookie of setCookies) {
          if (cookie.includes('__Secure-recent_mfa=')) {
            this.mfaToken = cookie.split('=')[1].split(';')[0];
            this.lastRefresh = Date.now();
            const elapsed = Date.now() - start;
            logger.info({ mfaLatencyMs: elapsed }, 'MFA token refreshed');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error({ error: error.message }, 'MFA refresh failed');
      return false;
    }
  }

  startAutoRefresh({ httpClient, discordToken, password, guildId, logger }) {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(async () => {
      await this.refresh({ httpClient, discordToken, password, guildId, logger });
    }, this.refreshInterval);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

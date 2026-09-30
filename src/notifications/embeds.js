export function buildSuccessEmbed({ vanity, guildId, latencyMs, releaseAt }) {
  return {
    color: 0x57f287,
    title: '✅ Vanity Claimed',
    description: `**${vanity}** has been claimed successfully`,
    fields: [
      { name: 'Vanity Code', value: `discord.gg/${vanity}`, inline: false },
      { name: 'Guild ID', value: `\`${guildId}\``, inline: true },
      { name: 'Latency', value: `\`${latencyMs}ms\``, inline: true },
      { name: 'Claim Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
    ],
    footer: { text: 'Vanity Sniper Pro' },
    timestamp: new Date().toISOString()
  };
}

export function buildGraceEmbed({ vanity, guildId, releaseAt }) {
  return {
    color: 0xfaa61a,
    title: '⏳ Grace Period Detected',
    description: `**${vanity}** entered grace period`,
    fields: [
      { name: 'Vanity Code', value: `discord.gg/${vanity}`, inline: false },
      { name: 'Guild ID', value: `\`${guildId}\``, inline: true },
      { name: 'Release Time', value: `<t:${Math.floor(releaseAt / 1000)}:F>`, inline: false }
    ],
    footer: { text: 'Vanity Sniper Pro' },
    timestamp: new Date().toISOString()
  };
}

export function buildFailureEmbed({ vanity, guildId, reason, latencyMs }) {
  return {
    color: 0xed4245,
    title: '❌ Claim Failed',
    description: `Failed to claim **${vanity}**`,
    fields: [
      { name: 'Vanity Code', value: `discord.gg/${vanity}`, inline: false },
      { name: 'Guild ID', value: `\`${guildId}\``, inline: true },
      { name: 'Reason', value: `\`${reason}\``, inline: false },
      { name: 'Latency', value: `\`${latencyMs}ms\``, inline: true }
    ],
    footer: { text: 'Vanity Sniper Pro' },
    timestamp: new Date().toISOString()
  };
}

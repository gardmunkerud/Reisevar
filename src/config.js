// Settings from .env (see .env.example).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env;
const contact = (env.MET_CONTACT || '').trim();

module.exports = {
  port: Number(env.PORT) || 3200,
  isProd: env.NODE_ENV === 'production',
  // Identification sent to the services we use. MET Norway requires contact information.
  appId: 'Reisevaer/0.1',
  metContact: contact,
  userAgent: contact ? `Reisevaer/0.1 ${contact}` : 'Reisevaer/0.1',
  routingUrl: (env.ROUTING_URL || 'https://routing.openstreetmap.de/routed-car').replace(/\/$/, ''),
  limits: {
    requestsPerWindow: Number(env.RATE_LIMIT) || 60,
    windowMs: 10 * 60 * 1000,
    maxDays: 21, // trip length in days; days beyond the forecast get stops without weather
    horizonDays: 9, // MET's forecast reaches about 9–10 days ahead
  },
  ads: adsConfig(),
};

// Google AdSense. ADS_ENABLED=true without a publisher ID and ad slot shows a preview box only.
function adsConfig() {
  const enabled = env.ADS_ENABLED === 'true';
  const client = /^ca-pub-\d{10,20}$/.test(env.ADSENSE_CLIENT || '') ? env.ADSENSE_CLIENT : '';
  const slot = /^\d{6,14}$/.test(env.ADSENSE_SLOT || '') ? env.ADSENSE_SLOT : '';
  return {
    enabled,
    client, // publisher ID, e.g. ca-pub-1234567890123456 (also used for ads.txt and site verification)
    slot, // ID of the ad unit created in AdSense
    live: enabled && Boolean(client && slot),
    preview: enabled && !(client && slot),
    // Test ads (no real impressions or clicks) unless running in production.
    test: env.ADSENSE_TEST ? env.ADSENSE_TEST === 'true' : env.NODE_ENV !== 'production',
  };
}

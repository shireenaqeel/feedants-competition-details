function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`Environment variable ${name} must be an integer`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const paymentProvider = process.env.PAYMENT_PROVIDER || 'mock';
if (paymentProvider !== 'mock' && paymentProvider !== 'razorpay') {
  throw new Error('PAYMENT_PROVIDER must be "mock" or "razorpay"');
}
if (paymentProvider === 'razorpay') {
  ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'].forEach(required);
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: int('PORT', 4000),
  mongoUri: required('MONGODB_URI'),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Public base URL of this API for links to uploaded files. Unset → derived from each request's host,
  // so a phone calling http://192.168.x.x:4000 gets links it can open.
  publicBaseUrl: process.env.PUBLIC_BASE_URL ? process.env.PUBLIC_BASE_URL.replace(/\/$/, '') : null,
  // Public web URL used in referral links.
  appUrl: (process.env.APP_URL || 'https://feedants.com').replace(/\/$/, ''),

  holdMinutes: int('REGISTRATION_HOLD_MINUTES', 10),
  holdSweepIntervalMs: int('HOLD_SWEEP_INTERVAL_MS', 30_000),

  payment: {
    provider: paymentProvider as 'mock' | 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret',
  },

  // Load the default competitions (past / ongoing / upcoming, plus demo users) when the API starts against an empty database.
  seedDemoDataOnEmpty: (process.env.SEED_DEMO_DATA || 'true') === 'true',

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadMb: int('MAX_UPLOAD_MB', 100),
};

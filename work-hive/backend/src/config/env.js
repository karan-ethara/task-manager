import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const { value, error } = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  MONGO_URI: Joi.string().pattern(/^mongodb(\+srv)?:\/\/.+$/).default('mongodb://127.0.0.1:27017/workhive'),
  JWT_SECRET: Joi.string().min(16).default('dev-secret-change-this'),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  CLIENT_URL: Joi.string().default('http://localhost:5173'),
  ADMIN_SEED_NAME: Joi.string().min(2).max(60).allow('').default(''),
  ADMIN_SEED_EMAIL: Joi.string().email().allow('').default(''),
  ADMIN_SEED_PASSWORD: Joi.string().min(8).max(100).allow('').default('')
})
  .unknown(true)
  .validate(process.env, { abortEarly: false, convert: true });

if (error) {
  throw new Error(`Invalid environment configuration: ${error.details.map((detail) => detail.message).join(', ')}`);
}

if (value.NODE_ENV === 'production') {
  if (value.JWT_SECRET === 'dev-secret-change-this') {
    throw new Error('Invalid environment configuration: JWT_SECRET must be explicitly set in production.');
  }

  if (!value.CLIENT_URL || value.CLIENT_URL.includes('localhost')) {
    throw new Error('Invalid environment configuration: CLIENT_URL must be a deployed frontend origin in production.');
  }
}

export const env = {
  nodeEnv: value.NODE_ENV,
  port: value.PORT,
  mongoUri: value.MONGO_URI,
  jwtSecret: value.JWT_SECRET,
  jwtExpiresIn: value.JWT_EXPIRES_IN,
  clientUrl: value.CLIENT_URL,
  adminSeedName: value.ADMIN_SEED_NAME,
  adminSeedEmail: value.ADMIN_SEED_EMAIL,
  adminSeedPassword: value.ADMIN_SEED_PASSWORD
};

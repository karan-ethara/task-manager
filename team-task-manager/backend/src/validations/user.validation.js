import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(60).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  role: Joi.string().valid('Admin', 'Team Lead', 'Member').default('Member'),
  team: Joi.string().hex().length(24).allow(null, ''),
  profileStatus: Joi.string().valid('Active', 'Away', 'Idle', 'Do Not Disturb').default('Active')
});

export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(60).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).max(100).optional(),
  role: Joi.string().valid('Admin', 'Team Lead', 'Member').optional(),
  team: Joi.string().hex().length(24).allow(null, '').optional(),
  profileStatus: Joi.string().valid('Active', 'Away', 'Idle', 'Do Not Disturb').optional(),
  isActive: Joi.boolean().optional()
});

export const updateMyStatusSchema = Joi.object({
  profileStatus: Joi.string().valid('Active', 'Away', 'Idle', 'Do Not Disturb').required()
});

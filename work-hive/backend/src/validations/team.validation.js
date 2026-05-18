import Joi from 'joi';

export const createTeamSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  leadId: Joi.string().hex().length(24).required()
});

export const updateTeamSchema = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  leadId: Joi.string().hex().length(24).optional()
});

export const teamMemberSchema = Joi.object({
  userId: Joi.string().hex().length(24).required()
});

import Joi from 'joi';

const noPastDeadline = (value, helpers) => {
  if (!value) return value;
  const selected = new Date(value);
  const today = new Date();
  selected.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  if (selected < today) {
    return helpers.error('any.invalid');
  }
  return value;
};

export const projectSchema = Joi.object({
  title: Joi.string().min(2).max(120).required(),
  description: Joi.string().max(1000).allow('', null),
  status: Joi.string().valid('Planned', 'In Progress', 'Completed', 'On Hold').default('Planned'),
  deadline: Joi.date().iso().allow(null, '').custom(noPastDeadline, 'no past deadline check'),
  team: Joi.string().hex().length(24).optional(),
  members: Joi.array().items(Joi.string().hex().length(24)).default([])
}).messages({
  'any.invalid': 'Deadline cannot be in the past'
});

export const projectUpdateSchema = Joi.object({
  title: Joi.string().min(2).max(120).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  status: Joi.string().valid('Planned', 'In Progress', 'Completed', 'On Hold').optional(),
  deadline: Joi.date().iso().allow(null, '').custom(noPastDeadline, 'no past deadline check').optional(),
  team: Joi.string().hex().length(24).optional(),
  members: Joi.array().items(Joi.string().hex().length(24)).optional()
}).messages({
  'any.invalid': 'Deadline cannot be in the past'
});

export const memberSchema = Joi.object({
  memberId: Joi.string().hex().length(24).required()
});

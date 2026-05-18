import Joi from 'joi';

export const taskSchema = Joi.object({
  title: Joi.string().min(2).max(140).required(),
  description: Joi.string().max(1500).allow('', null),
  project: Joi.string().hex().length(24).required(),
  assignedTo: Joi.string().hex().length(24).required(),
  team: Joi.string().hex().length(24).optional(),
  status: Joi.string().valid('Todo', 'In Progress', 'Completed').default('Todo'),
  priority: Joi.string().valid('Low', 'Medium', 'High').default('Medium'),
  dueDate: Joi.date().iso().required()
});

export const taskUpdateSchema = taskSchema.fork(['title', 'project', 'assignedTo', 'dueDate'], (field) => field.optional());

export const taskStatusSchema = Joi.object({
  status: Joi.string().valid('Todo', 'In Progress', 'Completed').required()
});

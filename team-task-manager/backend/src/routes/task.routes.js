import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  updateTask,
  updateTaskStatus
} from '../controllers/task.controller.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import { validateObjectId } from '../middleware/objectId.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { taskSchema, taskStatusSchema, taskUpdateSchema } from '../validations/task.validation.js';

const router = Router();

router.use(protect);

router.route('/')
  .get(getTasks)
  .post(restrictTo('Admin', 'Team Lead'), validate(taskSchema), createTask);

router.route('/:id')
  .all(validateObjectId('id'))
  .get(getTask)
  .put(restrictTo('Admin', 'Team Lead', 'Member'), validate(taskUpdateSchema), updateTask)
  .delete(restrictTo('Admin', 'Team Lead'), deleteTask);

router.patch('/:id/status', validateObjectId('id'), validate(taskStatusSchema), updateTaskStatus);

export default router;

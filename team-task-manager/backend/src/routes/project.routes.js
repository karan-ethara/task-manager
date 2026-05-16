import { Router } from 'express';
import {
  addMember,
  createProject,
  deleteProject,
  getProject,
  getProjects,
  removeMember,
  updateProject
} from '../controllers/project.controller.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import { validateObjectId } from '../middleware/objectId.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { memberSchema, projectSchema, projectUpdateSchema } from '../validations/project.validation.js';

const router = Router();

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(restrictTo('Admin', 'Team Lead'), validate(projectSchema), createProject);

router.route('/:id')
  .all(validateObjectId('id'))
  .get(getProject)
  .put(restrictTo('Admin', 'Team Lead'), validate(projectUpdateSchema), updateProject)
  .delete(restrictTo('Admin', 'Team Lead'), deleteProject);

router.post('/:id/members', validateObjectId('id'), restrictTo('Admin', 'Team Lead'), validate(memberSchema), addMember);
router.delete('/:id/members/:userId', validateObjectId('id', 'userId'), restrictTo('Admin', 'Team Lead'), removeMember);

export default router;

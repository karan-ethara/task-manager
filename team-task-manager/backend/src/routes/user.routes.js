import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, updateMyStatus, getUserProfile } from '../controllers/user.controller.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import { validateObjectId } from '../middleware/objectId.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createUserSchema, updateMyStatusSchema, updateUserSchema } from '../validations/user.validation.js';

const router = Router();

router.use(protect);

router.patch('/me/status', validate(updateMyStatusSchema), updateMyStatus);
router.get('/:id/profile', validateObjectId('id'), getUserProfile);
router.get('/', restrictTo('Admin', 'Team Lead', 'Member'), getUsers);
router.post('/', restrictTo('Admin', 'Team Lead'), validate(createUserSchema), createUser);
router.put('/:id', validateObjectId('id'), restrictTo('Admin', 'Team Lead'), validate(updateUserSchema), updateUser);
router.delete('/:id', validateObjectId('id'), restrictTo('Admin'), deleteUser);

export default router;

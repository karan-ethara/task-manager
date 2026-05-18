import { Router } from 'express';
import { addMember, createTeam, deleteTeam, getMyTeam, getTeam, getTeams, removeMember, updateTeam } from '../controllers/team.controller.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import { validateObjectId } from '../middleware/objectId.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createTeamSchema, teamMemberSchema, updateTeamSchema } from '../validations/team.validation.js';

const router = Router();

router.use(protect);

router.get('/my', getMyTeam);
router.get('/', getTeams);
router.get('/:id', validateObjectId('id'), getTeam);
router.post('/', restrictTo('Admin'), validate(createTeamSchema), createTeam);
router.put('/:id', validateObjectId('id'), restrictTo('Admin'), validate(updateTeamSchema), updateTeam);
router.delete('/:id', validateObjectId('id'), restrictTo('Admin'), deleteTeam);
router.post('/:id/members', validateObjectId('id'), restrictTo('Admin', 'Team Lead'), validate(teamMemberSchema), addMember);
router.delete('/:id/members/:userId', validateObjectId('id', 'userId'), restrictTo('Admin', 'Team Lead'), removeMember);

export default router;

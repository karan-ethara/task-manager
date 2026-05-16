import { env } from '../config/env.js';
import { User } from '../models/user.model.js';

export const ensureBootstrapAdmin = async () => {
  if (!env.adminSeedEmail || !env.adminSeedPassword) return;

  const existingAdmin = await User.findOne({ email: env.adminSeedEmail });
  if (existingAdmin) return;

  await User.create({
    name: env.adminSeedName,
    email: env.adminSeedEmail,
    password: env.adminSeedPassword,
    role: 'Admin'
  });

  console.log(`Bootstrap admin created for ${env.adminSeedEmail}`);
};
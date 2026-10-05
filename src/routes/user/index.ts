import { Elysia } from 'elysia';
import { profileRoutes } from './profile';

export const userRoutes = (env: Env) => new Elysia({ prefix: '/user' }).use(profileRoutes(env));

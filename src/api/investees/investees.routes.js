import { createInvestee, deleteInvestee, getInvestees, updateInvestee, updateInvesteeImage, fetchInvesteeById } from './investees.handlers.js'

import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'
import { authorize } from '../token.handlers.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/', { ...opts, config: { authorize: { role: [...config.roleGroups.admin.role, ...config.roleGroups.guest.role] } } }, getInvestees)
  fastify.post('/', { ...opts }, createInvestee)
  fastify.put('/:investeeId', { ...opts }, updateInvestee)
  fastify.get('/:investeeId', { ...opts }, fetchInvesteeById)
  fastify.put('/:investeeId/image', { ...opts }, updateInvesteeImage)
  fastify.delete('/:investeeId', { ...opts }, deleteInvestee)
}

export default routes

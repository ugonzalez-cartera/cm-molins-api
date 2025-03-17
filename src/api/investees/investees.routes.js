import investeesHandlers from './investees.handlers.js'

import { configAllowance } from '../services/authorization.service.js'
import config from '../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/', { ...opts, config: { authorize: { roles: [...config.roleGroups.admin.roles, ...config.roleGroups.guest.roles] } } }, investeesHandlers.getInvestees)
  fastify.post('/', { ...opts }, investeesHandlers.createInvestee)
  fastify.put('/:investeeId', { ...opts }, investeesHandlers.updateInvestee)
  fastify.get('/:investeeId', { ...opts }, investeesHandlers.fetchInvesteeById)
  fastify.put('/:investeeId/image', { ...opts }, investeesHandlers.updateInvesteeImage)
  fastify.delete('/:investeeId', { ...opts }, investeesHandlers.deleteInvestee)
}

export default routes

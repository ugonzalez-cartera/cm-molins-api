import { createInvestee, deleteInvestee, getInvestees, updateInvestee } from './investees.handlers.js'

import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/', { ...opts }, getInvestees)
  fastify.post('/', { ...opts }, createInvestee)
  fastify.put('/:investeeId', { ...opts }, updateInvestee)
  fastify.delete('/:investeeId', { ...opts }, deleteInvestee)
}

export default routes

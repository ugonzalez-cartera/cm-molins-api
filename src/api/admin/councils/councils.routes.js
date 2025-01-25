import { createCouncil, deleteCouncilsBucket, deleteCouncil } from './councils.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.post('/', { ...opts }, createCouncil)
  fastify.delete('/:councilYear', { ...opts }, deleteCouncilsBucket)
  fastify.put('/:councilYear/:councilId', { ...opts }, deleteCouncil)
}

export default routes

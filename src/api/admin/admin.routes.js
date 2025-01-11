import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'

import { getChangelogs } from './admin.handlers.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/changelogs/:logId', { ...opts }, getChangelogs)
}

export default routes

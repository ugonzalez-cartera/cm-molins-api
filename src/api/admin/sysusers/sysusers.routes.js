import { createSysUser, getSysUser, getSysUsers, updateSysUser } from './sysusers.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/', { ...opts }, getSysUsers)
  fastify.post('/', { ...opts }, createSysUser)
  fastify.get('/:sysUserId', { ...opts }, getSysUser)
  fastify.put('/:sysUserId', { ...opts }, updateSysUser)
}

export default routes

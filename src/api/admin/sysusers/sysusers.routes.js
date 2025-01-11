import { createSysuser, getSysuser, getSysusers, updateSysuser, deleteSysuser } from './sysusers.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/', { ...opts }, getSysusers)
  fastify.post('/', { ...opts }, createSysuser)
  fastify.get('/:sysuserId', { ...opts }, getSysuser)
  fastify.put('/:sysuserId', { ...opts }, updateSysuser)
  fastify.delete('/:sysuserId', { ...opts }, deleteSysuser)
}

export default routes

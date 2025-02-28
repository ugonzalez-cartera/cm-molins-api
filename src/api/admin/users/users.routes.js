import usersHandlers from './users.handlers.js'
import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config for read operations.
  const readOpts = {
    ...opts,
    config: configAllowance({
      roles: [...config.roleGroups.owner.roles, ...config.roleGroups.admin.roles, ...config.roleGroups.counselor.roles]
    })
  }

  // Set authorization config for owner-only operations.
  const ownerOpts = {
    ...opts,
    config: configAllowance({
      roles: [...config.roleGroups.owner.roles]
    })
  }

  // Read operations - accessible to owner, admin, and counselor.
  fastify.get('/', readOpts, usersHandlers.getUsers)
  fastify.get('/:userId', readOpts, usersHandlers.getUserById)

  // Write operations - restricted to owner only.
  fastify.post('/', ownerOpts, usersHandlers.createUser)
  fastify.put('/:userId', ownerOpts, usersHandlers.updateUser)
  fastify.delete('/:userId', ownerOpts, usersHandlers.deleteUser)
}

export default routes

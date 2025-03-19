import usersService from './users.service.js'

// --------------------
async function createUser (req, reply) {
  const { origin } = req.headers
  const { email, givenName, familyName, roles } = req.body || {}

  try {
    const user = await usersService.createUser({ email, givenName, familyName, roles, origin })
    return user
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
export async function getUsers (req, reply) {
  const { id: userId } = req.user
  const { limit, page, sort, roles } = req.query || {}

  try {
    const { docs, docCount } = await usersService.getUsers({ userId, limit, page, sort, roles })
    return {
      docs,
      docCount,
    }
  } catch (err) {
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function getUserById (req, reply) {
  const { userId } = req.params

  try {
    const user = await usersService.getUserById(userId)
    return user
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function updateUser (req, reply) {
  const { id: requesterId } = req.user
  const { userId } = req.params
  const { givenName, familyName, email, isNotActive, roles } = req.body

  try {
    const user = await usersService.updateUser({ requesterId, userId, givenName, familyName, email, roles, isNotActive })
    return user
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function deleteUser (req, reply) {
  const { userId } = req.params
  try {
    await usersService.deleteUser(userId)
    return { message: 'OK' }
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

export default {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
}

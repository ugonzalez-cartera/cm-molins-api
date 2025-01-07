import mongoose from 'mongoose'

const SysUsers = mongoose.model('SysUser')

// --------------------
export async function getSelfUser (req, reply) {
  const { id } = req.user

  console.info(id)

  try {
    const user = await SysUsers.findById(id).lean()
    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not get sysUser', err)
    return reply.internalServerError(err)
  }
}
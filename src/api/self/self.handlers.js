import mongoose from 'mongoose'

const Sysusers = mongoose.model('Sysuser')
const Counselors = mongoose.model('Counselor')

// --------------------
export async function getSelfUser (req, reply) {
  const { id } = req.user

  try {
    let user = await Sysusers.findOne({ _id: id }).lean()
    if (!user) {
      user = await Counselors.findOne({ _id: id }).lean()
    }

    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not get sysuser.', err)
    return reply.internalServerError(err)
  }
}

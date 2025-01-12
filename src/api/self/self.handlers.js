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
    console.error(' !! Could not get user.', err)
    return reply.internalServerError(err)
  }
}

// --------------------
export async function updateSelfUser (req, reply) {
  const { id: userId } = req.user
  const { givenName, familyName, email } = req.body

  try {
    let prefix = 'sys_'

    let user = await Sysusers.findOne({ _id: userId })
    if (!user) {
      user = await Counselors.findOne({ _id: userId })
      prefix = 'coun_'
    }

    if (!user) return reply.notFound('User not found.')

    user.givenName = givenName
    user.familyName = familyName
    user.email = email

    console.info(user, 'user')

    await user.save()

    return user
  } catch (err) {
    console.error(' !! Could not update user.', err)
    return reply.internalServerError(err)
  }
}

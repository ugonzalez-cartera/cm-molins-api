'use strict'

import mongoose from 'mongoose'

const CouncilsBucket = mongoose.model('CouncilBucket')

// --------------------
export async function getCouncils (req, reply) {
  const { page, limit, sort = '-_id' } = req.query

  const skip = (limit * page) - limit

  try {
    const [docs, docsCount] = await Promise.all([
      CouncilsBucket.find({}).skip(skip).limit(limit).sort(sort).lean(),
      CouncilsBucket.countDocuments({})
    ])

    return {
      docs,
      docsCount,
    }
  } catch (err) {
    console.error(' !! Could not get councils.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function getCouncilsBucketByYear (req, reply) {
  const { councilYear } = req.params

  try {
    const council = await CouncilsBucket.findOne({ _id: councilYear }).lean()

    return council
  } catch (err) {
    console.error(' !! Could not get council by year.', councilYear, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function getCouncil (req, reply) {
  try {
    const { councilYear, councilId } = req.params
    const council = await CouncilsBucket.findOne({ _id: councilYear, 'councils._id': councilId.toUpperCase() }, { 'councils.$': 1 }).lean()

    return council
  } catch (err) {
    console.error(' !! Could not get council.', councilYear, councilId, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function deleteCouncilsBucket (req, reply) {
  const { councilYear } = req.params

  try {
    await CouncilsBucket.deleteOne({ _id: councilYear })

    return 'OK'
  } catch (err) {
    console.error(' !! Could not delete council bucket.', councilYear, err)
    reply.internalServerError(err)
  }
}

'use strict'

import mongoose from 'mongoose'

const CouncilsBucket = mongoose.model('CouncilBucket')

// --------------------
export async function getCouncils (req, reply) {
  const {  sort } = req.query

  try {
    const [docs, docsCount] = await Promise.all([
      CouncilsBucket.find({}).sort(sort).lean(),
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
export async function getCouncilsByYear (req, reply) {
  const { councilYear } = req.params

  try {
    const [council] = await CouncilsBucket.aggregate([
      { $match: { _id: councilYear } },
      { $unwind: '$councils' },
      { $sort: { 'councils._id': 1 } },
      { $group: { _id: '$_id', councils: { $push: '$councils' } } }
    ])

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

    const council = await CouncilsBucket.findOne(
      { _id: councilYear, councils: { $elemMatch: { _id: councilId.toUpperCase() } } },
      { 'councils.$': 1 }
    ).lean()

    if (!council) return reply.notFound('Council not found.')

    return council.councils[0]
  } catch (err) {
    console.error(' !! Could not get council.', err)
    reply.internalServerError(err)
  }
}

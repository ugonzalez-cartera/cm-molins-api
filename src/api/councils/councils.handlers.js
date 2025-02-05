'use strict'

import mongoose from 'mongoose'

const Councils = mongoose.model('Council')

// --------------------
export async function getCouncils (req, reply) {
  try {
    const result = await Councils.aggregate([
      { $group: { _id: '$year' } },
      { $sort: { _id: -1 } }
    ])

    return {
      docs: result.map(item => item._id),
      docsCount: result.length,
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
    const year = Number(councilYear)

    const councils = await Councils.find({ year }).lean()

    return councils
  } catch (err) {
    console.error(' !! Could not get council by year.', councilYear, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function getCouncil (req, reply) {
  try {
    const { councilId } = req.params

    const council = await Councils.findOne({ _id: councilId }).lean()

    if (!council) return reply.notFound('Council not found.')

    return council
  } catch (err) {
    console.error(' !! Could not get council.', err)
    reply.internalServerError(err)
  }
}

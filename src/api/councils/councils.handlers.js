'use strict'

import mongoose from 'mongoose'

import dayjs from 'dayjs'

import { CustomError } from '../../utils.js'

const Councils = mongoose.model('Council')

// --------------------
export async function getCouncils (req, reply) {
  const { coming } = req.query

  try {
    if (coming) {
      const comingCouncils = await Councils.findOne({ date: { $gte: dayjs().toISOString() } }).lean()

      return {
        docs: comingCouncils ? [comingCouncils] : [],
        docsCount: comingCouncils?.length ?? 0,
      }
    } else {
      const result = await Councils.aggregate([
        { $group: { _id: '$year' } },
        { $sort: { _id: -1 } },
      ])

      return {
        docs: result.map(item => item._id),
        docsCount: result.length,
      }
    }
  } catch (err) {
    const error = new CustomError({
      title: err.title || 'getCouncils error exception',
      detail: err.detail || 'getCouncils error exception',
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    return reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
export async function getCouncilsByYear (req, reply) {
  const { councilYear } = req.params

  try {
    const year = Number(councilYear)

    const councils = await Councils.find({ year }).sort({ month: 1 }).lean()

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

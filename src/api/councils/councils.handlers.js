'use strict'

import mongoose from 'mongoose'

import dayjs from 'dayjs'

import { CustomError } from '../../utils.js'
import { getPresignedUrl } from '../../services/utils.service.js'

const Councils = mongoose.model('Council')

async function _resolveFileUrl (file) {
  if (!file?.publicId) return file
  const presignedUrl = await getPresignedUrl(file.publicId)
  return presignedUrl ? { ...file, secureUrl: presignedUrl } : file
}

async function _resolveCouncilUrls (council) {
  if (!council) return council
  const resolved = { ...council }
  if (council.report?.file) resolved.report = { ...council.report, file: await _resolveFileUrl(council.report.file) }
  if (council.agenda?.file) resolved.agenda = { ...council.agenda, file: await _resolveFileUrl(council.agenda.file) }
  if (council.minutes?.file) resolved.minutes = { ...council.minutes, file: await _resolveFileUrl(council.minutes.file) }
  if (council.docs?.length > 0) resolved.docs = await Promise.all(council.docs.map(_resolveFileUrl))
  return resolved
}

// --------------------
export async function getCouncils (req, reply) {
  const { coming } = req.query

  try {
    if (coming) {
      const comingCouncil = await Councils.findOne({ date: { $gte: dayjs().startOf('day').toISOString() } }).lean()
      const resolved = await _resolveCouncilUrls(comingCouncil)

      return {
        docs: resolved ? [resolved] : [],
        docsCount: resolved ? 1 : 0,
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

    return Promise.all(councils.map(_resolveCouncilUrls))
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

    return _resolveCouncilUrls(council)
  } catch (err) {
    console.error(' !! Could not get council.', err)
    reply.internalServerError(err)
  }
}

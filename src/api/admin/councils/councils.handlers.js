'use strict'

import mongoose from 'mongoose'
import { uploadFile } from '../../../services/utils.service.js'
import { getParsedDate } from '../../../utils.js'

const CouncilsBucket = mongoose.model('CouncilBucket')

export async function getCouncils (req, reply) {
  const { page, limit, sort = '-_id' } = req.query

  const filter = {}
  const skip = (limit * page) - limit

  try {
    const councils = await CouncilsBucket.find().skip(skip).limit(limit).sort(sort)

    return councils
  } catch (err) {
    console.error(' !! Could not get councils.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function createCouncil (req, reply) {
  const additionalDocs = []
  let reportFile = {}
  let month, year, agenda
  let newCouncilBucket
  let newCouncil
  let updatedFiles = 0

  try {
    if (req.isMultipart()) {
      const parts = req.files()
      for await (const part of parts) {
        if (part.file && part.fieldname === 'councilAdditionalDocs') {
          updatedFiles +=1
          if (updatedFiles > 3) {
            return reply.badRequest('Maximum of 3 additionalDocs allowed for docs.')
          }
        }

        const councilData = part.fields?.councilData?.value ? JSON.parse(part.fields?.councilData?.value) : {}
        const { date, agenda: councilAgenda } = councilData
        if (! date || !councilAgenda) return reply.badRequest('Missing required fields.')

        const parsedData = getParsedDate(date)
        month = parsedData.month
        year = parsedData.year
        agenda = councilAgenda


        const buffer = await part.toBuffer()
        const dir = part.fieldname === 'councilAdditionalDocs' ? 'additional-docs' : 'reports'

        const folder = `carteracm/councils/${month}-${year}/${dir}`
        const uploadImageResult = await uploadFile(buffer, folder, part.filename)

        if (part.fieldname === 'councilAdditionalDocs') {
          additionalDocs.push({
            secureUrl: uploadImageResult.secure_url,
            publicId: uploadImageResult.public_id
          })
        }

        if (part.fieldname === 'councilReport') {
          reportFile = {
            secureUrl: uploadImageResult.secure_url,
            publicId: uploadImageResult.public_id
          }
        }
      }

      const parsedAgenda = agenda.replace(/(?:\r\n|\r|\n)/g, '<br>')

       newCouncil = {
        _id: `${month}_${year}`,
        report: reportFile,
        docs: additionalDocs.length > 0 ? additionalDocs : undefined,
        agenda: parsedAgenda,
      }
    } else {
      const { date, agenda } = req.body || {}
      if (!date || !agenda) return reply.badRequest('Missing required fields.')

      const parsedAgenda = agenda.replace(/(?:\r\n|\r|\n)/g, '<br>')
      const parsedData = getParsedDate(date)
      month = parsedData.month
      year = parsedData.year

      newCouncil = {
        _id: `${month}_${year}`,
        agenda: parsedAgenda,
      }
    }

    newCouncilBucket = await CouncilsBucket.findOneAndUpdate(
      { _id: year },
      { $push: { councils: newCouncil } },
      { upsert: true, new: true }
    )
    return newCouncilBucket
  } catch (err) {
    console.error(' !! Could not create council.', err)
    reply.internalServerError(err)
  }
}

'use strict'

import mongoose from 'mongoose'
import { uploadFile } from '../../../services/utils.service.js'
import { getParsedDate } from '../../../utils.js'

const Councils = mongoose.model('Council')


export async function getCouncils (req, reply) {
  const { page, limit, sort = 'year' } = req.query

  const filter = {}
  const skip = (limit * page) - limit

  try {
    const councils = await Councils.find().skip(skip).limit(limit).sort(sort)

    return councils
  } catch (err) {
    console.error(' !! Could not get councils.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function createCouncil (req, reply) {

  const parts = req.files()

  const additionalDocs = []
  let reportFile = {}
  let month, year, agenda

  const { date, agenda: councilAgenda } = req.body || {}

  console.info('Creating council with date:', date, agenda)

  try {
    if (req.isMultipart()) {
      const parts = req.files()

      for await (const part of parts) {
        if (part.file && part.fieldname === 'councilAdditionalDocs') {
          additionalDocs.push(part)
          if (additionalDocs.length > 3) {
            return reply.badRequest('Maximum of 3 additionalDocs allowed for docs.')
          }
        }

        const councilData = part.fields?.councilData?.value ? JSON.parse(part.fields?.councilData?.value) : {}
        const { date, agenda: councilAgenda } = councilData
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
    } else {
      const parsedData = getParsedDate(date)
      month = parsedData.month
      year = parsedData.year
      agenda = councilAgenda
    }

    const parsedAgenda = agenda.replace(/(?:\r\n|\r|\n)/g, '<br>')

    const council = new Councils({
      _id: `${month}_${year}`,
      report: reportFile,
      agenda: parsedAgenda,
      year,
      month,
      docs: additionalDocs.length > 0 ? additionalDocs : undefined
    })


    await council.save()

    return council
  } catch (err) {
    console.error(' !! Could not create council.', err)
    reply.internalServerError(err)
  }
}

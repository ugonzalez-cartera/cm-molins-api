'use strict'

import mongoose from 'mongoose'

import { getParsedDate } from '../../../utils.js'
import {  uploadFile } from '../../../services/utils.service.js'

import dayjs from 'dayjs'

const CouncilsBucket = mongoose.model('CouncilBucket')

// --------------------
export async function createCouncil (req, reply) {
  const additionalDocs = []
  let reportFile = {}
  let month, year, agenda
  let newCouncilBucket
  let newCouncil
  let filesToUpload = 0

  try {
    if (req.isMultipart()) {
      const parts = req.files()
      for await (const part of parts) {
        if (part.file && part.fieldname === 'councilAdditionalDocs') {
          filesToUpload +=1
          if (filesToUpload > 3) {
            return reply.badRequest('Maximum of 3 additionalDocs allowed for docs.')
          }
        }

        const councilData = part.fields?.councilData?.value ? JSON.parse(part.fields?.councilData?.value) : {}
        const { date, agenda: councilAgenda } = councilData
        if (! date || !councilAgenda) return reply.badRequest('Missing required fields.')

        const parsedData = getParsedDate(dayjs(date).add(1, 'day'))
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
        _id: `${month}-${year}`,
        report: reportFile,
        docs: additionalDocs.length > 0 ? additionalDocs : undefined,
        agenda: parsedAgenda,
      }
    } else {
      const { date, agenda } = req.body || {}
      if (!date || !agenda) return reply.badRequest('Missing required fields.')

      const parsedAgenda = agenda.replace(/(?:\r\n|\r|\n)/g, '<br>')
      const parsedData = getParsedDate(dayjs(date).add(1, 'day'))
      month = parsedData.month
      year = parsedData.year

      newCouncil = {
        _id: `${month}-${year}`,
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

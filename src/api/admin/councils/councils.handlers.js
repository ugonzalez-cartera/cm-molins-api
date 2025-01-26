'use strict'

import mongoose from 'mongoose'

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
        if (!date || !councilAgenda) return reply.badRequest('Missing required fields.')

          agenda = councilAgenda
          month = dayjs(date).month()
          year = dayjs(date).year()

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
      month = dayjs(date).month()
      year = dayjs(date).year()

      newCouncil = {
        _id: `${month}-${year}`,
        agenda: parsedAgenda,
      }
    }

    newCouncilBucket = await CouncilsBucket.findOneAndUpdate(
      { _id: year, councils: { $not: { $elemMatch: { _id: `${month}-${year}` } } } },
      { $push: { councils: newCouncil } },
      { upsert: true, new: true }
    )

    return newCouncilBucket
  } catch (err) {
  if (err.code === 11000) { // Duplicate key error code
    reply.code(409).send({ error: 'Council already exists' })
  } else {
    console.error(' !! Could not create council.', err)
    reply.internalServerError(err)
  }
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

// --------------------
export async function deleteCouncil (req, reply) {
  const { councilYear, councilId } = req.params

  try {
    const councilBucket = await CouncilsBucket.findOneAndUpdate(
      { _id: councilYear },
      { $pull: { councils: { _id: councilId } } },
      { new: true }
    )

    if (councilBucket.councils.length === 0) {
      // Clean up bucket if no more councils.
      await CouncilsBucket.deleteOne({ _id: councilYear })
    }
  } catch (err) {
    console.error(' !! Could not delete council year.', councilYear, err)
    reply.internalServerError(err)
  }
}

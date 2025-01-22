'use strict'

import mongoose from 'mongoose'

import { uploadFile, deleteImage, createChangeLog } from '../../../services/utils.service.js'

import dayjs from 'dayjs'

const Councils = mongoose.model('Council')

export async function createCouncil (req, reply) {
  const parts = req.files()
  const files = []

  try {

  for await (const part of parts) {
    if (part.file) {
      files.push(part)
      if (files.length > 3) {
        return reply.badRequest('Maximum of 3 files allowed for docs')
      }
    }


    const buffer = await part.toBuffer()

    const { date, agenda } = JSON.parse(part.fields.councilData.value)
    const month =  dayjs(date).format('MMMM')
    const year = dayjs(date).format('YYYY')
    console.info(month, year, agenda)
    const folder = `carteracm/councils/${part.fieldname}`
    const uploadImageResult = await uploadFile(buffer, folder, part.filename)
  }

  // console.info(files, 'files')
//     const council = new Councils({
//       _id: `${month.toUpperCase()}_${year}`,
//       minutes,
//       report,
//       agenda,
//       call,
//       docs: files
//     })
//
//     await council.save()
//
//     return council
  } catch (err) {
    console.error(' !! Could not create council', err)
    reply.internalServerError(err)
  }
}

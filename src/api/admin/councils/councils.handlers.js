'use strict'

import mongoose from 'mongoose'

import { uploadImage, deleteImage, createChangeLog } from '../../../services/utils.service.js'


const Councils = mongoose.model('Council')

export async function createCouncil (req, reply) {
  const parts = req.files()
  const files = []


  // const { year, month, minutes, report, agenda, call } = fields

  try {

  for await (const part of parts) {
    if (part.file) {
      files.push(part)
      if (files.length > 3) {
        return reply.badRequest('Maximum of 3 files allowed for docs')
      }
    }

    const buffer = await part.toBuffer()

    const folder = 'carteracm/councils/docs'
    const uploadImageResult = await uploadImage(buffer, folder, part.filename)
  }

  console.info(files, 'files')
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

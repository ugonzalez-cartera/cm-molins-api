'use strict'

import mongoose from 'mongoose'
import axios from 'axios'
import streamifier from 'streamifier'
import { v2 as cloudinary } from 'cloudinary'
import { customAlphabet } from 'nanoid'

import config from '../config.js'

import { getChangeLogChanges } from '../utils.js'

import ChangeLogs from '../models/0_changelog.model.js'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Password generation consts and function (defined here as it will be used extensively).
const numbers = '0123456789'
const alpha = 'abcdefghijklmnopqrstuvwxyz'
const upperCaseAlpha = alpha.toUpperCase()
const specialChars = '!@#&'
const allChars = numbers + alpha + upperCaseAlpha + specialChars
const newPassword = customAlphabet(allChars, 12)

// --------------------
export async function sendNotificationEmail (emailData, options = { isNoReply: false, template: 'default' }) {
  // If this is a test email, don't send it.
  const dummyDomains = ['test.com', 'prueba.com']
  if (dummyDomains.includes(emailData.email.split('@')[1])) {
    return null
  }

  const { email: emailTo, name: nameTo, familyName: familyNameTo, subject: emailSubject, ...params } = emailData

  const subjectPrefix = process.env.NODE_ENV !== 'production' ? 'TEST - ' : ''

  try {
    const dataToSend = {
      subject: `${subjectPrefix}${emailSubject}`,
      sender: { name: 'Cartera C.M', email: 'ugonzalezcartera@gmail.com' },
      replyTo: { name: 'Cartera C.M', email: 'ugonzalezcartera@gmail.com' },
      to: [{ email: emailTo, name: nameTo }],
      templateId: emailData.templateId || config.brevo.template.notification,
      params: { items: [{ ...params, name: nameTo, familyName: familyNameTo }] },
    }

    if (emailData.attachment) dataToSend.attachment = emailData.attachment

    const { data } = await axios.post(config.brevo.endpoint,
      dataToSend,
    {
      headers: {
        'api-key': `${process.env.BREVO_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    return data
  } catch (err) {
    console.error('  !! Error sending notification email')
    console.error('         status:', err.response?.status)
    console.error('     statusText:', err.response?.statusText, '\n')
    throw err
  }
}

// --------------------
export function generateStrongPassword () {
  let password = newPassword()
  // A bit of a brute force approach, but we're using it for the sake of code simplicity.
  while (!config.strongPassword.test(password)) {
    password = newPassword()
  }

  return password
}

// --------------------
export async function uploadFile (buffer, folder, fileName) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        upload_preset: 'ml_default',
        public_id: fileName,
        resource_type: 'auto',
        format: 'jpg',
      },
      (error, result) => {
        if (result) resolve(result)
        else reject(error)
      },
    )

    streamifier.createReadStream(buffer).pipe(uploadStream)
  })
}

// --------------------
export async function deleteFile (publicId) {
  const result = await cloudinary.uploader.destroy(publicId)

  return result
}

// --------------------
export function arraysOverlap (arr1, arr2) {
  return arr1.some((item) => arr2.includes(item))
}

// --------------------
export async function createChangeLog (stream, prefix, collection) {
  let resumeToken

  stream.on('change', async next => {
    if (next.operationType === 'delete') return

    const oldData = next.fullDocumentBeforeChange
    const newData = next.updateDescription?.updatedFields || {}

    try {
      const changes = getChangeLogChanges(oldData, newData)

      for (const change of changes) {
        const data = {
          key: change.key,
          old: change.old,
          new: change.new,
          updatedBy: oldData.updatedBy,
        }

        await ChangeLogs.updateOne(
          { _id: `${prefix}${oldData._id}` },
          { $push: { changes: data } },
          { upsert: true },
        )

        resumeToken = next._id

        stream.close()
      }
    } catch (err) {
      console.error(' !! Could not create changelog', err)
    }
  })

  stream.on('error', err => {
    console.error(' !! Change stream error', err)
    if (resumeToken) {
      const newStream = collection.watch({ resumeAfter: resumeToken, fullDocumentBeforeChange: 'required' })
      createChangeLog(newStream, prefix, collection)
    }
  })

  stream.on('close', () => {
    if (resumeToken) {
      const newStream = collection.watch({ resumeAfter: resumeToken, fullDocumentBeforeChange: 'required' })
      createChangeLog(newStream, prefix, collection)
    }
  })
}

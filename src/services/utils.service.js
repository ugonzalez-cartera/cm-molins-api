'use strict'

import axios from 'axios'
import streamifier from 'streamifier'
import { v2 as cloudinary } from 'cloudinary'
import { customAlphabet } from 'nanoid'
import * as Minio from 'minio'

import config from '../config.js'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const useMinIO = !!(process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY)

const _minioRawEndpoint = process.env.MINIO_ENDPOINT
let _minioUrl = null
if (_minioRawEndpoint) {
  const normalizedEndpoint = _minioRawEndpoint.startsWith('http') ? _minioRawEndpoint : `http://${_minioRawEndpoint}`
  _minioUrl = new URL(normalizedEndpoint)
}

const minioEndpoint = _minioUrl?.hostname
const _minioPortFromUrl = _minioUrl?.port ? Number(_minioUrl.port) : null
const _minioPort = process.env.MINIO_PORT
  ? Number.parseInt(process.env.MINIO_PORT)
  : (_minioPortFromUrl || undefined)
const _minioUseSSL = process.env.MINIO_USE_SSL === undefined
  ? _minioUrl?.protocol === 'https:'
  : process.env.MINIO_USE_SSL === 'true'

const minioClient = useMinIO
  ? new Minio.Client({
    endPoint: minioEndpoint,
    ...(_minioPort !== undefined && { port: _minioPort }),
    useSSL: _minioUseSSL,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    region: process.env.MINIO_REGION || 'eu-west-2',
  })
  : null

const minioBucket = process.env.MINIO_BUCKET

// Password generation consts and function (defined here as it will be used extensively).
const numbers = '0123456789'
const alpha = 'abcdefghijklmnopqrstuvwxyz'
const upperCaseAlpha = alpha.toUpperCase()
const specialChars = '!@#&'
const allChars = numbers + alpha + upperCaseAlpha + specialChars
const newPassword = customAlphabet(allChars, 12)

// --------------------
export async function sendNotificationEmail (emailData) {
  // If this is a test email, don't send it.
  const dummyDomains = ['test.com', 'prueba.com']
  if (dummyDomains.includes(emailData.email.split('@')[1])) {
    return null
  }

  const { email: emailTo, name: nameTo, familyName: familyNameTo, subject: emailSubject, ...params } = emailData

  const subjectPrefix = process.env.NODE_ENV === 'production' ? '' : 'TEST - '

  try {
    const dataToSend = {
      subject: `${subjectPrefix}${emailSubject}`,
      sender: { name: 'Cartera de inversiones C.M', email: 'carteracm@carteracm.com' },
      replyTo: { name: 'Cartera de inversiones C.M', email: 'carteracm@carteracm.com' },
      to: [{ email: emailTo, name: nameTo }],
      params: { items: [{ ...params, name: nameTo, familyName: familyNameTo }] },
    }

    if (emailData.templateId) {
      dataToSend.templateId = emailData.templateId || config.brevo.template.notification
    } else {
      dataToSend.htmlContent = emailData.htmlContent
    }

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
async function minioEnsureBucket () {
  const exists = await minioClient.bucketExists(minioBucket)
  if (!exists) {
    const region = process.env.MINIO_REGION || 'eu-west-2'
    await minioClient.makeBucket(minioBucket, region)
    console.info(`MinIO bucket "${minioBucket}" created in region "${region}"`)
  }
}

async function minioUploadFile (buffer, folder, fileName) {
  await minioEnsureBucket()
  const objectName = `${folder}/${fileName}`
  await minioClient.putObject(minioBucket, objectName, buffer, buffer.length)
  const protocol = process.env.MINIO_USE_SSL === 'false' ? 'http' : 'https'
  const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : ''
  const secure_url = `${protocol}://${minioEndpoint}${port}/${minioBucket}/${objectName}`
  return { secure_url, public_id: objectName }
}

async function minioDeleteFile (objectName) {
  await minioClient.removeObject(minioBucket, objectName)
}

async function minioDeleteResourcesByPrefix (prefix) {
  const objectsList = await new Promise((resolve, reject) => {
    const objects = []
    const stream = minioClient.listObjects(minioBucket, prefix, true)
    stream.on('data', (obj) => objects.push(obj.name))
    stream.on('end', () => resolve(objects))
    stream.on('error', reject)
  })
  if (objectsList.length > 0) {
    await minioClient.removeObjects(minioBucket, objectsList)
  }
}

// --------------------
export async function uploadFile (buffer, folder, fileName) {
  if (useMinIO) {
    try {
      return await minioUploadFile(buffer, folder, fileName)
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        upload_preset: 'ml_default',
        public_id: fileName,
        resource_type: 'auto',
      },
      (error, result) => {
        if (result) resolve(result)
        else reject(new Error(error?.message || 'Cloudinary upload failed'))
      },
    )
    streamifier.createReadStream(buffer).pipe(uploadStream)
  })
}

// --------------------
export async function deleteFile (publicId) {
  if (useMinIO) {
    try {
      return await minioDeleteFile(publicId)
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId)
    return result
  } catch (err) {
    console.error(err)
    throw err
  }
}

// --------------------
export async function deleteFolder (folder) {
  if (useMinIO) {
    try {
      return await minioDeleteResourcesByPrefix(folder)
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  try {
    const result = await cloudinary.api.delete_folder(folder)
    return result
  } catch (err) {
    console.error(err)
    throw err
  }
}

// --------------------
export async function deleteResourcesByPrefix (prefix) {
  if (useMinIO) {
    try {
      return await minioDeleteResourcesByPrefix(prefix)
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  try {
    const result = await cloudinary.api.delete_resources_by_prefix(prefix)
    return result
  } catch (err) {
    console.error(err)
    throw err
  }
}

// --------------------
export async function getPresignedUrl (publicId, expirySeconds = 3600) {
  if (!useMinIO) return null
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('MinIO presigned URL timed out')), 5000)
    )
    return await Promise.race([
      minioClient.presignedGetObject(minioBucket, publicId, expirySeconds),
      timeout,
    ])
  } catch (err) {
    console.error('getPresignedUrl error:', err.message)
    return null
  }
}

// --------------------
export function arraysOverlap (arr1, arr2) {
  return arr1.some((item) => arr2.includes(item))
}

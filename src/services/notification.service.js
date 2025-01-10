import mongoose from 'mongoose'

import { sendNotificationEmail } from './utils.service.js'

const UsersMetadata = mongoose.model('UserMetadata')

// --------------------
export async function sendRequestResetPasswordEmail (userData, token, baseUrl) {
  try {
    // Only send the central part of the token (the payload).
    const tokenPayload = token.split('.')[1]

    const locale = userData.country || 'es'

    const emailData = {
      name: userData.givenName,
      familyName: userData.familyName.toUpperCase(),
      email: userData.email.toUpperCase(),
      locale,
      subject: `Restablecer contraseña - ${userData.givenName} ${userData.familyName}`,
      body: 'Para poder restablecer tu contraseña, haz clic en el botón:',
      ctaLink: `${baseUrl}/newpassword?email=${userData.email}&key=${tokenPayload}&lang=${locale}`,
      ctaText: 'Restablecer contraseña',
    }

    await sendNotificationEmail(emailData)
  } catch (err) {
    console.error(`  !! Could not send request reset password email to ${userData.email}`, err)
  }
}


export async function sendCreateUserEmail ({ userData, emailData, token, baseUrl }) {
  // Only send the central part of the token (the payload).
  const tokenPayload = token.split('.')[1]

  const locale = userData.country || 'es'

  try {
    const { verificationToken } = await UsersMetadata.findOne({ _id: userData._id }).select('+verificationToken').lean()
    if (!verificationToken) {
      console.error(' !! Verification token not found for:', userData.email)
      return
    }

    const emailTemplate = {
      name: userData.givenName,
      familyName: userData.familyName,
      email: userData.email,
      locale,
      subject: emailData.subject,
      greeting: emailData.greeting,
      body: emailData.body,
      ctaLink: `${baseUrl}/newpassword?email=${userData.email}&key=${tokenPayload}&lang=${locale}`,
      ctaText: emailData.ctaText,
    }

    await sendNotificationEmail(emailTemplate)

  } catch (err) {
    console.error(err)
  }
}

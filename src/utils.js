'use strict'

import dayjs from 'dayjs'
import 'dayjs/locale/es.js'

export function getParsedDate (date) {
  const month = dayjs(date).locale('es').format('MMMM').toUpperCase()
  const year = dayjs(date).format('YYYY')
  return { month, year }
}

// --------------------
// This custom Error class is used to handle errors in the API.
// https://www.rfc-editor.org/rfc/rfc7807
export class CustomError extends Error {
  static toJSON ({
    title = 'Error',
    detail = '',
    status = 500,
    type = 'about:blank',
    instance = ''
    })
  {
    return {
      title,
      detail,
      status,
      type,
      instance,
    }
  }
}

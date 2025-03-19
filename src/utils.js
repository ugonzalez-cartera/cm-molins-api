'use strict'

import dayjs from 'dayjs'
import 'dayjs/locale/es.js'

// --------------------
export function getParsedDate(date) {
  const month = dayjs(date).locale('es').format('MMMM').toUpperCase()
  const year = dayjs(date).format('YYYY')
  return { month, year }
}

// --------------------
// This custom Error class is used to handle errors in the API.
// https://www.rfc-editor.org/rfc/rfc7807
export class CustomError extends Error {
  constructor(options = {}) {
    super(options.detail || options.title || 'Unknown error')

    this.name = options.name || 'CustomError'
    this.title = options.title
    this.detail = options.detail
    this.status = options.status
    this.severity = options.severity || 'error'
    this.type = options.type
    this.instance = options.instance
    this.code = options.code
  }

  toJSON () {
    return {
      name: this.name,
      title: this.title,
      detail: this.detail,
      status: this.status,
      severity: this.severity,
      type: this.type || 'about:blank',
      instance: this.instance,
      code: this.code,
    }
  }

  print () {
    const severity = this.severity === 'error' ? 'ERROR' : 'WARNING'
    const message =
      `\n =================== \n` +
      `${JSON.stringify(this.toJSON(), null, 2)}` +
      `\n =================== \n`

    if (severity === 'WARNING') {
      console.warn(message)
    } else {
      console.error(message)
    }

  }
}

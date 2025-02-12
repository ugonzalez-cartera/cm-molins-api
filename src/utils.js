'use strict'

import dayjs from 'dayjs'
import 'dayjs/locale/es.js'

export function getParsedDate (date) {
  const month = dayjs(date).locale('es').format('MMMM').toUpperCase()
  const year = dayjs(date).format('YYYY')
  return { month, year }
}

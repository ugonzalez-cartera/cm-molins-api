export function getChangeLogChanges(oldObj, newObj, parentKey = '') {
  const changes = []

  for (const key in newObj) {
    const newKey = parentKey ? `${parentKey}.${key}` : key
    if (typeof newObj[key] === 'object' && newObj[key] !== null && !Array.isArray(newObj[key])) {
      changes.push(...getChangeLogChanges(oldObj[key] || {}, newObj[key], newKey))
    } else if (!isDeepEqual(newObj[key], oldObj[key])) {
      changes.push({
        key: newKey,
        old: oldObj[key],
        new: newObj[key]
      })
    }
  }

  return changes
}

// --------------------
function isDeepEqual(obj1, obj2) {
  if (obj1 === obj2) return true

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false
  }

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !isDeepEqual(obj1[key], obj2[key])) {
      return false
    }
  }

  return true
}

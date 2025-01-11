export function getChangeLogChanges (oldObj, newObj, parentKey = '') {
  const changes = []

  for (const key in newObj) {
    const newKey = parentKey ? `${parentKey}.${key}` : key;
    if (typeof newObj[key] === 'object' && newObj[key] !== null && !Array.isArray(newObj[key])) {
      changes.push(...getChangeLogChanges(oldObj[key] || {}, newObj[key], newKey))
    } else if (newObj[key] !== oldObj[key]) {
      changes.push({
        key: newKey,
        old: oldObj[key],
        new: newObj[key]
      });
    }
  }

  return changes
}

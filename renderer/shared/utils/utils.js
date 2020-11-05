import {getRpcParams} from '../api/api-client'

export function createRpcCaller({url, key}) {
  return async function(method, ...params) {
    const {result, error} = await (
      await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          params,
          id: 1,
          key,
        }),
      })
    ).json()
    if (error) throw new Error(error.message)
    return result
  }
}

export function callRpc(method, ...params) {
  return createRpcCaller(getRpcParams())(method, ...params)
}

export function toPercent(value) {
  return value.toLocaleString(undefined, {
    style: 'percent',
    maximumSignificantDigits: 4,
  })
}

export const toLocaleDna = (locale, options) => {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 18,
    ...options,
  })
  return value => `${formatter.format(value)} iDNA`
}

export const eitherState = (current, ...states) => states.some(current.matches)

export const merge = predicate => (...lists) =>
  lists.reduce(
    (agg, curr) =>
      agg.length
        ? agg.map(item => ({
            ...item,
            ...curr.find(predicate(item)),
          }))
        : curr,
    []
  )

export const byId = ({id: givenId}) => ({id: currentId}) =>
  currentId === givenId

export const mergeById = (...items) => merge(byId)(...items)

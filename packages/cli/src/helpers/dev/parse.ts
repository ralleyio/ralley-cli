import { Method } from 'axios'
import { URL } from 'url'
import { size, toNumber, isObject, merge, isPlainObject, isArray } from 'lodash'
import { IncomingMessage } from 'http'
import queryString from 'query-string'
import { Request, RequestRequest } from '#/request'

export async function parseMessage (request: IncomingMessage): Promise<RequestRequest> {
  const queryPos = request.url?.indexOf('?') || -1
  const path = queryPos > -1 ? request?.url?.substring(0, queryPos) || '/' : request.url || '/'
  const query = queryPos > -1 ? queryString.parseUrl(request?.url?.substring(queryPos) || '') : null

  return {
    method: (request.method || 'post').toUpperCase() as Method,
    url: request.url || '/',
    headers: (request.headers || {}) as any,
    scheme: 'http',
    host: 'test',
    path,
    params: query?.query || {},
    body: await getBody(request),
  }
}

export async function getBody (request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const body: any[] = []
    request.on('data', (chunk) => {
      body.push(chunk)
    }).on('end', () => {
      const buffer = Buffer.concat(body).toString('base64')
      resolve(buffer)
    })
  })
}

export function parseRequest (id: string, workspace: string, request: RequestRequest) {
  let fullUrl = request.url
  if (!fullUrl.startsWith('http')) {
    fullUrl = `https://${fullUrl}`
  }

  const parsedUrl = new URL(fullUrl)
  const mergedParams = merge({}, queryString.parseUrl(fullUrl).query, request.params)
  const options = getRawOptionsFromHeaderAndParams(request.headers || {}, mergedParams)
  const format = formatRawOptions(options)
  const received = Date.now() / 1000
  const delay = getDelayFromOptions(options, received)

  let headers = cleanHeaders(request.headers || {})
  const params = cleanParams(mergedParams, request.headers || {})
  const modUrl = queryString.parseUrl(fullUrl, { parseFragmentIdentifier: true })
  const method = request.method || 'POST'

  // Normalize request body
  if (request.body) {
    if (!headers) headers = {}
    if (!headers['content-type']) {
      if (isPlainObject(request.body) || isArray(request.body)) headers['content-type'] = 'application/json'
      else headers['content-type'] = 'text/plain'
    }

    if (isPlainObject(request.body) || isArray(request.body)) {
      request.body = JSON.stringify(request.body)
    }

    request.body = Buffer.from(request.body).toString('base64')
    request.hasbody = true
  }

  return {
    id,
    status: 'PENDING',
    workspace,
    source: 'REQUEST',
    request: {
      ...request,
      method,
      headers,
      params,
      url: queryString.stringifyUrl({
        url: modUrl.url,
        query: params,
        fragmentIdentifier: modUrl.fragmentIdentifier,
      }),
      host: parsedUrl.host,
      scheme: parsedUrl.protocol.replace(':', ''),
      path: parsedUrl.pathname,
    },
    start: delay > 0 ? delay : received,
    received: received,
    attempts: 0,
    ...format,
  } as Request
}

export function getRawOptionsFromHeaderAndParams (headers?: any, params?: any) {
  let p = params
  if (headers['x-ralley-no-conflict']) {
    p = {}
  }
  return {
    key: headers['x-ralley-key'] || p._key || 'default',
    delay: headers['x-ralley-delay'] || p._delay,
    delayuntil: headers['x-ralley-delay-until'] || p._delay_until,
    retry: headers['x-ralley-retry'] || p._retry,
    interval: headers['x-ralley-interval'] || p._interval,
    cron: headers['x-ralley-cron'] || p._cron,
    throttle: headers['x-ralley-throttle'] || p._throttle,
    timezone: headers['x-ralley-timezone'] || p._timezone,
    trace: headers['x-ralley-trace'] || p._trace,
    env: headers['x-ralley-env'] || p._env,
  }
}

export function getDelayFromOptions (options: any, start: number): number {
  if (options.delayuntil) return options.delayuntil
  if (options.delay) return options.delay + start
  return 0
}

export function formatRawOptions (options: any) {
  if (options.delayuntil) {
    options.delayuntil = toNumber(options.delayuntil)
  }

  if (options.delay) {
    options.delay = toNumber(options.delay)
  }

  if (options.retry) {
    // TODO: will this work with null params?
    const [max = 1, backoff = 'FIXED', time = 1] = (options.retry || '').split('|')
    options.retry = {
      max,
      backoff: backoff ? backoff.toUpperCase() : 'FIXED',
      time,
    }
  }

  if (options.cron) {
    options.cron = options.cron.split(',').map((c: string) => c.split(/[| ]/))
  }

  if (options.interval) {
    options.interval = toNumber(options.interval)
  }

  return options
}

export function cleanParams (params?: any, headers?: any) {
  if (!params) return params
  if (headers?.['x-ralley-no-conflict'] === '1') return params
  delete params._key
  delete params._delay
  delete params._delay_until
  delete params._retry
  delete params._interval
  delete params._cron
  delete params._throttle
  delete params._timezone
  delete params._trace
  delete params._token
  delete params._env
  if (!size(params)) return undefined
  return params
}

export function cleanHeaders (headers: any) {
  delete headers.host
  delete headers['x-ralley-key']
  delete headers['x-ralley-delay']
  delete headers['x-ralley-delay-until']
  delete headers['x-ralley-retry']
  delete headers['x-ralley-interval']
  delete headers['x-ralley-cron']
  delete headers['x-ralley-throttle']
  delete headers['x-ralley-timezone']
  delete headers['x-ralley-trace']
  delete headers['x-ralley-token']
  delete headers['x-ralley-env']
  if (!size(headers)) return undefined
  return headers
}

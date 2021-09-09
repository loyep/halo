import { isOnlyApi } from '@/utils'
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import crypto from 'crypto'
import { Response } from 'express-serve-static-core'
import { isEmpty } from 'lodash'
import { firstValueFrom, Observable, of } from 'rxjs'
import { render } from '@kova/ssr'
import { UserConfig } from 'ssr-types'
import { Readable, Stream } from 'stream'
import { FileCacheService } from '../cache'
import { RedirectException } from '../exceptions/redirect.exception'
import { SSR_RENDER_METADATA } from './ssr-render.constants'
import { isDev } from '@/utils'

const REFLECTOR = 'Reflector'

const md5 = (key: string) => {
  const hash = crypto.createHash('md5')
  return hash.update(key).digest('hex')
}

// const bundle = getBundleInfo()
const bundleVersion = '1' //`${bundle.version}(${bundle.build})`

export interface SsrRenderOptions {
  stream?: boolean
  cache?: boolean
  mode?: 'csr' | 'ssr'
}

@Injectable()
export class SsrRenderInterceptor implements NestInterceptor {
  @Inject(REFLECTOR)
  protected readonly reflector: Reflector
  protected renderContext: any

  @Inject(FileCacheService)
  private readonly cache: FileCacheService

  private readonly config: UserConfig = {
    parallelFetch: false,
    stream: false,
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp()
    const req = http.getRequest()
    const res = http.getResponse<Response>()
    const match = this.reflector.get(PATH_METADATA, context.getHandler())

    if (isOnlyApi) {
      throw new NotFoundException(`Cannot ${req.method} ${req.path}`)
    }
    const ssrRenderMeta = this.reflector.get(SSR_RENDER_METADATA, context.getHandler())
    req.match = match
    const { cache = false, ...options } = ssrRenderMeta || {}
    const mode = req.query.csr === 'true' ? 'csr' : options.mode ?? 'ssr'
    let result: any
    let key: string
    const disableCache = isDev || req.get('cache-control') === 'no-cache'
    if (!disableCache && cache) {
      key = `v${bundleVersion}_${req.path.replace(/[\/?=]/g, '')}_${md5(req.url)}`
      result = await this.cache.get(key)
    }

    if (!isEmpty(result)) {
      return of(result)
    }

    try {
      if (mode === 'ssr') {
        result = await firstValueFrom(next.handle())
      }
      this.renderContext = {
        request: req,
        response: {},
        ...result,
      }
      res.contentType('text/html')
      const content = await this.getRenderContent({
        ...this.config,
        ...options,
        mode,
      })
      if (content instanceof Stream) {
        await this.sendStream(res, content)
      } else {
        if (!disableCache) {
          this.cache.set(key, content, 300).then(() => {})
        }
        return of(content)
      }
    } catch (error) {
      console.log(error)
      if (error instanceof RedirectException) {
        res.redirect(error.getRedirectUrl())
      } else {
        throw new InternalServerErrorException(error.message)
      }
    }
  }

  async getRenderContent(options: any) {
    const { mode } = options
    if (mode === 'csr') {
      return await this.renderCsr(options)
    }

    try {
      return await render<Readable>(this.renderContext, options)
    } catch (error) {
      if (mode !== 'csr' && mode !== 'ssr') {
        return await this.renderCsr(options)
      } else {
        throw error
      }
    }
  }

  sendStream(res: Response, stream) {
    return new Promise<void>((resolve, reject) => {
      stream.pipe(res, { end: false })
      stream.on('end', () => {
        res.end()
        resolve()
      })
      stream.on('error', (err) => {
        reject(err)
      })
    })
  }

  async renderCsr(options) {
    return await render<Readable>(this.renderContext, {
      ...this.config,
      mode: 'csr',
    })
  }
}

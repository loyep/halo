import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express-serve-static-core'
import { firstValueFrom, Observable, of } from 'rxjs'
import { RedirectException } from '../exceptions/redirect.exception'
import { render } from 'ssr-core-react'
import { Readable, Stream } from 'stream'
import { SSR_RENDER_METADATA } from './ssr-render.constants'
import { CacheService } from '../cache'
import { UserConfig } from 'ssr-types'
import crypto from 'crypto'
// import { getBundleInfo } from '@kova/core'
import { PATH_METADATA } from '@nestjs/common/constants'
import { isOnlyApi } from '@/utils'

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

const isDev = process.env.NODE_ENV !== 'production'

@Injectable()
export class SsrRenderInterceptor implements NestInterceptor {
  @Inject(REFLECTOR)
  protected readonly reflector: Reflector
  protected renderContext: any

  @Inject(CacheService)
  private readonly cache: CacheService

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
    let result: any
    let key: string
    const disableCache = isDev || req.get('cache-control') === 'no-cache'

    if (!disableCache && cache) {
      key = `v${bundleVersion}_${req.path.replace(/[\/?=]/g, '')}_${md5(req.url)}`
      result = await this.cache.get(key)
    }

    if (result) {
      return of(result)
    }

    try {
      result = await firstValueFrom(next.handle())
      this.renderContext = {
        request: req,
        response: {},
        ...result,
      }
      res.contentType('text/html')
      const content = await this.getRenderContent({
        ...this.config,
        ...options,
      })
      if (content instanceof Stream) {
        await this.sendStream(res, content)
      } else {
        if (!disableCache) {
          this.cache.set(key, content, 300).then(() => {
            //
          })
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
    try {
      return await render<Readable>(this.renderContext, options)
    } catch (error) {
      console.log(error)
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

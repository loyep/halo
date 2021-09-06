import { Injectable } from '@nestjs/common'
import { LoggerService } from '@/core/logger'
import { isEmpty, isFunction } from 'lodash'
import { FileStore } from './store/file.store'

type DefCallback<T> = null | undefined | T | (() => Promise<T> | T)

@Injectable()
export class FileCacheService {
  static readonly foreverTtl = 0
  public store: FileStore
  private readonly ttl = 600

  constructor(private readonly logger: LoggerService) {
    this.store = new FileStore()
  }

  async get<T = any>(key: string, def: DefCallback<T> = null): Promise<T | null> {
    const cached = await this.store.get(key)
    if (cached) {
      try {
        return JSON.parse(cached) as T
      } catch (error) {
        this.logger.log(JSON.stringify({ data: { error } }))
      }
      return null
    }

    if (def) {
      return await this._value(def)
    }
    return null
  }

  async pull<T = any>(key: string, def: DefCallback<T> = null): Promise<T | null> {
    const cached: T | null = await this.get(key)
    if (cached) {
      await this.forget(key)
    }
    if (def) {
      return await this._value(def)
    }
    return cached
  }

  async forget(key: string): Promise<boolean> {
    return await new Promise((resolve) =>
      this.store.del(key, (err) => {
        resolve(!err)
      }),
    )
  }

  async put<T>(key: string, value: T, ttl = this.ttl): Promise<boolean> {
    let res: 'OK' | null
    if (ttl === 0) {
      res = await this.store.set(key, JSON.stringify(value))
    } else {
      res = await this.store.set(key, JSON.stringify(value))
    }
    return res !== null
  }

  async has(key: string): Promise<boolean> {
    return !isEmpty(await this.get(key))
  }

  async missing(key: string): Promise<boolean> {
    return !(await this.has(key))
  }

  async add<T>(key: string, value: T, ttl = this.ttl): Promise<T | boolean> {
    const exists = await this.has(key)
    if (!exists) {
      return await this.put(key, value, ttl)
    }
    return false
  }

  async remember<T>(key: string, callback: DefCallback<T>, ttl = this.ttl) {
    let value: T | null = await this.get(key)
    if (!value || isEmpty(value)) {
      value = await this._value(callback)
      await this.put(key, value, ttl)
    }
    return value
  }

  async forever<T>(key: string, value: T) {
    return await this.put(key, value, FileCacheService.foreverTtl)
  }

  /**
   * Get an item from the cache, or execute the given Closure and store the result forever.
   *
   * @param key
   * @param callback
   */
  async sear<T>(key: string, callback: DefCallback<T>) {
    return await this.rememberForever(key, callback)
  }

  async set<T>(key: string, value: T, ttl = this.ttl) {
    return await this.put(key, value, ttl)
  }

  async increment(key: string, value = 1, ttl = this.ttl) {
    const raw = await this.get(key, 0)
    return await this.put(key, raw + value, ttl)
  }

  async rememberForever<T>(key: string, callback: DefCallback<T>) {
    return await this.remember(key, callback, FileCacheService.foreverTtl)
  }

  private _value<T>(callback: DefCallback<T>): Promise<T | null>
  private async _value(callback: unknown) {
    return isFunction(callback) ? callback() : callback
  }
}

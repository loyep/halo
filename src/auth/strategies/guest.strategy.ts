import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-local'
import { AuthService } from '../auth.service'

@Injectable()
export class GuestStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly service: AuthService) {
    super()
  }

  async validate(username: string, password: string): Promise<any> {
    const user = await this.service.validateUser(username, password)
    if (!user) {
      throw new UnauthorizedException()
    }
    return user
  }
}

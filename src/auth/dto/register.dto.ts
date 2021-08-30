import { IsEmail, IsString, Length } from 'class-validator'
import { ErrorCode } from '@/constants/error'
import { UserConstants } from '@/constants/constants'

export enum LoginVerifyType {
  phone = 'phone',
  email = 'username',
}

export class RegisterDto {
  @IsString()
  readonly name: string

  @Length(UserConstants.PASSWORD_MIN_LENGTH, UserConstants.PASSWORD_MAX_LENGTH, {
    message: ErrorCode.InvalidPassword.MESSAGE,
    context: {
      code: ErrorCode.InvalidPassword.CODE,
    },
  })
  @IsString({
    message: ErrorCode.InvalidPassword.MESSAGE,
    context: {
      code: ErrorCode.InvalidPassword.CODE,
    },
  })
  readonly password: string

  @IsEmail()
  readonly email: string
}

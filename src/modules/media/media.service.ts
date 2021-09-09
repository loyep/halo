import { Injectable } from '@nestjs/common'
import { Media, Prisma } from '@prisma/client'
import { plainToClass } from 'class-transformer'
import { MediaModel } from '@/models/media'
import { PrismaService } from '@/prisma'
import fs from 'fs'
import path from 'path'

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  async getMedia(MediaWhereUniqueInput: Prisma.MediaWhereUniqueInput): Promise<Media | null> {
    const data = await this.prisma.media.findUnique({
      where: MediaWhereUniqueInput,
    })
    return plainToClass(MediaModel, data)
  }

  async medias(
    params: {
      skip?: number
      take?: number
      cursor?: Prisma.MediaWhereUniqueInput
      where?: Prisma.MediaWhereInput
      orderBy?: Prisma.MediaOrderByInput
    } = {},
  ): Promise<Media[]> {
    const { skip, take, cursor, where, orderBy } = params
    const data = await this.prisma.media.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    })
    return plainToClass(MediaModel, data)
  }

  async createMedia(data: Prisma.MediaCreateInput): Promise<Media> {
    return this.prisma.media.upsert({
      create: data,
      update: data,
      where: {
        path: data.path,
      },
    })
  }

  async createMedias(data: Prisma.Enumerable<Prisma.MediaCreateManyInput>): Promise<any> {
    return await this.prisma.media.createMany({
      data,
    })
  }

  async updateMedia(params: { where: Prisma.MediaWhereUniqueInput; data: Prisma.MediaUpdateInput }): Promise<Media> {
    const { where, data } = params
    return this.prisma.media.update({
      data,
      where,
    })
  }

  removeFiles(files: Express.Multer.File[]) {
    for (const file of files) {
      const filePath = path.join(process.cwd(), file.path)
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          console.log(`删除${file.originalname}${err ? '失败' : '成功'}`)
        })
      }
    }
  }

  async deleteMedia(where: Prisma.MediaWhereUniqueInput): Promise<Media> {
    return this.prisma.media.delete({
      where,
    })
  }
}

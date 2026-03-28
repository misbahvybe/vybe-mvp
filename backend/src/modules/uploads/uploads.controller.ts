import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { multerImageFileOptions, publicUploadedImageUrl } from '../../common/uploads/image-multer';

/**
 * Single image upload for web + mobile. Store panel and admin panel both use this path
 * so role checks stay explicit (ADMIN | STORE_OWNER). JwtAuthGuard is global in AppModule.
 */
@Controller('uploads')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.STORE_OWNER)
export class UploadsController {
  @Post('image')
  @UseInterceptors(FileInterceptor('file', multerImageFileOptions()))
  uploadImage(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Upload a JPEG, PNG, GIF, or WebP image (max 5 MB)');
    }
    return { imageUrl: publicUploadedImageUrl(req, file.filename) };
  }
}

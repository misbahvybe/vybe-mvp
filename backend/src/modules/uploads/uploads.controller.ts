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
import { isCloudinaryConfigured, uploadProductImageToCloudinary } from '../../common/uploads/cloudinary';

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
  async uploadImage(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Upload a JPEG, PNG, GIF, or WebP image (max 5 MB)');
    }

    // If Cloudinary is configured, prefer it (persists across deploys).
    if (isCloudinaryConfigured() && file.buffer) {
      const { secureUrl } = await uploadProductImageToCloudinary({
        buffer: file.buffer,
        mimetype: file.mimetype,
      });
      return { imageUrl: secureUrl };
    }

    // Fallback: local disk URL (works for local dev, but not persistent on many hosts).
    return { imageUrl: publicUploadedImageUrl(req, file.filename) };
  }
}

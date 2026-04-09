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
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  multerImageFileOptions,
  PRODUCTS_UPLOAD_DIR,
  publicUploadedImageUrl,
} from '../../common/uploads/image-multer';
import { isCloudinaryConfigured, uploadProductImageToCloudinary } from '../../common/uploads/cloudinary';

function safeImageExtension(file: Express.Multer.File): string {
  const fromName = extname(file.originalname || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fromName)) {
    return fromName === '.jpeg' ? '.jpg' : fromName;
  }
  const m = file.mimetype.toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  return '.jpg';
}

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

    if (!file.buffer?.length) {
      throw new BadRequestException('Empty image upload');
    }

    // If Cloudinary is configured, prefer it (persists across deploys).
    if (isCloudinaryConfigured()) {
      const { secureUrl } = await uploadProductImageToCloudinary({
        buffer: file.buffer,
        mimetype: file.mimetype,
      });
      return { imageUrl: secureUrl };
    }

    // Fallback: write buffer to disk (local dev; ephemeral on many PaaS hosts).
    const filename = `${randomUUID()}${safeImageExtension(file)}`;
    await writeFile(join(PRODUCTS_UPLOAD_DIR, filename), file.buffer);
    return { imageUrl: publicUploadedImageUrl(req, filename) };
  }
}

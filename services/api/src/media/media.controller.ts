import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { ALL_CACHE_NAMESPACES, InvalidatesCache } from '../common/cache/cache.constants.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type AuthenticatedUser } from '../auth/types.js';
import { ApiPaginatedResponse } from '../common/dto/paginated-response.dto.js';
import {
  MediaService,
  type ActorContext,
  type UploadedFile as MediaFile,
} from './media.service.js';
import { ListMediaDto, MediaAssetDto, UploadMediaDto } from './dto/media.dto.js';
import { ACCEPTED_MIME_TYPES } from './processing/file-signature.js';

/**
 * Admin media library (§20).
 *
 * Every route requires a permission — there is no public upload, and no public
 * listing. Public *delivery* of published assets happens through the CDN, not
 * through this controller.
 */
@ApiTags('media')
@ApiBearerAuth('access-token')
// Any media write can change a URL that a cached page embeds — a replaced
// photo, a deleted certificate — and there is no cheap way to know which pages
// referenced it. Purging every namespace is the honest answer: media writes are
// rare, and serving a page whose images 404 is not.
@InvalidatesCache(...ALL_CACHE_NAMESPACES)
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @Permissions('media:upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file',
    description: `Type is detected from magic bytes, not from the filename or Content-Type. Accepted: ${ACCEPTED_MIME_TYPES.join(', ')}. SVG is deliberately rejected — a user-uploaded SVG served from our origin is stored XSS.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        visibility: { type: 'string', enum: ['PRIVATE', 'PUBLIC'] },
        altText: { type: 'string' },
        title: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({ type: MediaAssetDto })
  // Multer's own limit, so an oversized body is refused as it streams rather
  // than after it has been read into memory. The service re-checks the size:
  // this bound protects the process, that one protects the contract.
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1 } }))
  async upload(
    @UploadedFile() file: MediaFile | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<MediaAssetDto> {
    return this.media.upload(requireFile(file), dto, actorFrom(user, request));
  }

  @Put(':id/file')
  @Permissions('media:upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Replace a file, keeping its id',
    description:
      'Products and articles reference the id, so replacing lets the client swap a photo without editing every page that points at it.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: MediaAssetDto })
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1 } }))
  async replace(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: MediaFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<MediaAssetDto> {
    return this.media.replace(id, requireFile(file), actorFrom(user, request));
  }

  @Get()
  @Permissions('media:read')
  @ApiOperation({ summary: 'List media' })
  @ApiPaginatedResponse(MediaAssetDto)
  async list(@Query() query: ListMediaDto) {
    return this.media.list(query);
  }

  @Get(':id')
  @Permissions('media:read')
  @ApiOperation({
    summary: 'Media metadata',
    description:
      'URLs are signed and short-lived for private assets, so responses are not cacheable.',
  })
  @ApiOkResponse({ type: MediaAssetDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<MediaAssetDto> {
    return this.media.findOne(id);
  }

  @Delete(':id')
  @Permissions('media:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a file',
    description:
      'Removes the stored objects and soft-deletes the row, so anything still referencing the id resolves to an explanation rather than to nothing.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<void> {
    await this.media.remove(id, actorFrom(user, request));
  }
}

function requireFile(file: MediaFile | undefined): MediaFile {
  if (file === undefined) {
    // Thrown here rather than in the service so the service can assume a file.
    throw new BadRequestException({
      message: 'A file is required',
      code: 'MEDIA_FILE_REQUIRED',
    });
  }
  return file;
}

function actorFrom(user: AuthenticatedUser, request: Request): ActorContext {
  return {
    userId: user.id,
    email: user.email,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

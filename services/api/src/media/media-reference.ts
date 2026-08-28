import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

/**
 * Checks that a media id points at a live asset of the expected kind.
 *
 * Both halves matter. A missing asset would leave a row referencing nothing —
 * a broken image or a download that 404s. A wrong kind is worse because it
 * looks fine in the database: attaching a PDF to a gallery renders a broken
 * image, and attaching a photograph as a certificate offers the visitor a
 * download that is not the document it claims to be.
 */
export async function assertMediaKind(
  prisma: PrismaService,
  mediaAssetId: string,
  kind: 'IMAGE' | 'DOCUMENT' | 'VIDEO',
): Promise<void> {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, deletedAt: null },
    select: { kind: true },
  });

  if (asset === null) {
    throw new BadRequestException({ message: 'Media asset not found', code: 'MEDIA_NOT_FOUND' });
  }
  if (asset.kind !== kind) {
    throw new BadRequestException({
      message: `Expected a ${kind.toLowerCase()} asset`,
      code: 'MEDIA_KIND_MISMATCH',
    });
  }
}

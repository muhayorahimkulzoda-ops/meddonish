import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class LessonAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async assertCanViewLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: true },
    });
    if (!lesson) throw new AppException('LESSON_NOT_FOUND', 'Lesson not found');
    if (lesson.isFreePreview && lesson.status === 'published') return lesson;
    await this.entitlements.assertActive(userId, lesson.section.courseId);
    return lesson;
  }

  async assertCanPlayVideo(userId: string, videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: { lesson: { include: { section: true } } },
    });
    if (!video) throw new AppException('VIDEO_NOT_FOUND', 'Video not found');
    if (!video.sourceKey && video.status !== 'READY') {
      throw new AppException('VIDEO_NOT_READY', 'Video is still processing');
    }
    await this.assertCanViewLesson(userId, video.lessonId);
    return video;
  }

  async assertCanViewDocument(userId: string, documentId: string) {
    const link = await this.prisma.lessonDocument.findFirst({
      where: { documentId },
      include: { lesson: { include: { section: true } }, document: true },
    });
    if (!link) throw new AppException('DOCUMENT_NOT_FOUND', 'Document not found');
    await this.assertCanViewLesson(userId, link.lessonId);
    return link.document;
  }
}

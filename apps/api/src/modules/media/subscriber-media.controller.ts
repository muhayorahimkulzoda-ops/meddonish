import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppException } from '../../common/errors';
import { lessonTopicTitle } from '../../common/topic-title';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { SubscriberPayload } from '../auth/jwt.strategy';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import { LessonAccessService } from './lesson-access.service';
import { MediaSessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoProgressDto } from './video-progress.dto';

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SubscriberMediaController {
  constructor(
    private readonly access: LessonAccessService,
    private readonly sessions: MediaSessionService,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly settings: SettingsService,
  ) {}

  @Get('courses/:courseId/lessons')
  async courseLessons(
    @Param('courseId') courseId: string,
    @Req() req: Request & { user: SubscriberPayload },
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: 'published' },
      include: {
        translations: true,
        sections: {
          where: { status: 'published' },
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: true,
            lessons: {
              where: { status: 'published' },
              orderBy: { sortOrder: 'asc' },
              include: {
                translations: true,
                tests: { where: { isActive: true }, select: { id: true, title: true, questionCount: true, mode: true } },
                videos: {
                  select: { originalName: true, updatedAt: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        tests: { where: { isActive: true, lessonId: null }, select: { id: true, title: true, questionCount: true, mode: true } },
      },
    });
    if (!course) throw new AppException('COURSE_NOT_FOUND', 'Course not found');
    let entitled = false;
    try {
      await this.entitlements.assertActive(req.user.userId, courseId);
      entitled = true;
    } catch {
      entitled = false;
    }
    return {
      id: course.id,
      slug: course.slug,
      translations: course.translations,
      entitled,
      tests: course.tests,
      sections: course.sections.map((section) => ({
        id: section.id,
        translations: section.translations,
        lessons: section.lessons.map((lesson) => ({
          id: lesson.id,
          isFreePreview: lesson.isFreePreview,
          accessible: entitled || lesson.isFreePreview,
          translations: lesson.translations,
          topicTitle: lessonTopicTitle(lesson.translations, lesson.videos[0]?.originalName, {
            lessonUpdatedAt: lesson.updatedAt,
            videoUpdatedAt: lesson.videos[0]?.updatedAt,
          }),
          tests: lesson.tests,
        })),
      })),
    };
  }

  @Get('lessons/:lessonId')
  async lesson(
    @Param('lessonId') lessonId: string,
    @Req() req: Request & { user: SubscriberPayload },
  ) {
    await this.access.assertCanViewLesson(req.user.userId, lessonId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: {
        translations: true,
        videos: { include: { variants: true } },
        documents: { include: { document: true } },
        tests: { where: { isActive: true } },
        situationalTasks: true,
        clinicalCases: { include: { _count: { select: { steps: true, media: true } } } },
      },
    });
    return {
      id: lesson.id,
      status: lesson.status,
      isFreePreview: lesson.isFreePreview,
      translations: lesson.translations,
      videos: lesson.videos.map((video) => ({
        id: video.id,
        status: video.status,
        durationSec: video.durationSec,
        variants: video.variants.map((variant) => ({
          quality: variant.quality,
          protocol: variant.protocol,
        })),
      })),
      documents: lesson.documents.map((item) => ({
        id: item.document.id,
        title: item.document.title,
      })),
      tests: lesson.tests.map((test) => ({
        id: test.id,
        title: test.title,
        questionCount: test.questionCount,
        mode: test.mode,
      })),
      simpleCases: lesson.situationalTasks.map((task) => ({
        id: task.id,
        kind: task.kind,
        title: (task.payload as { title?: string }).title ?? task.kind,
      })),
      clinicalCases: lesson.clinicalCases.map((item) => ({
        id: item.id,
        title: item.title,
        steps: item._count.steps,
      })),
    };
  }

  @Post('videos/:videoId/playback-session')
  async playback(
    @Param('videoId') videoId: string,
    @Req() req: Request & { user: SubscriberPayload },
  ) {
    await this.access.assertCanPlayVideo(req.user.userId, videoId);
    return this.sessions.playback(videoId, req.user.userId, req.user.deviceRecordId);
  }

  @Post('videos/:videoId/progress')
  progress(
    @Param('videoId') videoId: string,
    @Body() body: VideoProgressDto,
    @Req() req: Request & { user: SubscriberPayload },
  ) {
    return this.recordProgress(req.user.userId, videoId, body);
  }

  @Post('videos/:videoId/heartbeat')
  heartbeat(
    @Param('videoId') videoId: string,
    @Body() body: VideoProgressDto,
    @Req() req: Request & { user: SubscriberPayload },
  ) {
    return this.recordProgress(req.user.userId, videoId, body);
  }

  @Post('documents/:documentId/view-session')
  async viewPdf(
    @Param('documentId') documentId: string,
    @Req() req: Request & { user: SubscriberPayload },
  ) {
    await this.access.assertCanViewDocument(req.user.userId, documentId);
    return this.sessions.viewPdf(documentId, req.user.userId);
  }

  private async recordProgress(userId: string, videoId: string, body: VideoProgressDto) {
    await this.access.assertCanPlayVideo(userId, videoId);
    const threshold = Number(await this.settings.get(SETTING_KEYS.videoCompletedPercent, 90));
    const completed = body.watchPercent >= threshold;
    return this.prisma.videoProgress.upsert({
      where: { userId_videoId: { userId, videoId } },
      create: {
        userId,
        videoId,
        watchSeconds: body.watchSeconds,
        watchPercent: body.watchPercent,
        durationSeconds: body.durationSeconds ?? 0,
        completed,
      },
      update: {
        watchSeconds: body.watchSeconds,
        watchPercent: body.watchPercent,
        durationSeconds: body.durationSeconds ?? undefined,
        completed,
        lastSeenAt: new Date(),
      },
      select: {
        watchSeconds: true,
        watchPercent: true,
        completed: true,
        lastSeenAt: true,
      },
    });
  }
}

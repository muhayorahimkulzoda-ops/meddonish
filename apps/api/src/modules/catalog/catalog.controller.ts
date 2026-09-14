import { Body, Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppException } from '../../common/errors';
import { lessonTopicTitle } from '../../common/topic-title';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaSessionService } from '../media/session.service';
import { gradeAttempt } from '../testing/grading';
import { publicPaymentMethods } from '../payments/wallets';
import { buildOffer, storeSku, year3BundleFromOffer } from './offer';
import { GradePublicTestDto } from './public-test.dto';

@ApiTags('public')
@Controller('public')
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: MediaSessionService,
  ) {}

  @Get('disciplines')
  disciplines() {
    return this.prisma.discipline.findMany({
      where: { status: 'published' },
      include: { translations: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get('courses')
  courses() {
    return this.prisma.course.findMany({
      where: { status: 'published' },
      include: {
        translations: true,
        discipline: { include: { translations: true } },
        prices: { include: { plan: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('courses/:slug')
  async course(@Param('slug') slug: string) {
    const course = await this.prisma.course.findFirstOrThrow({
      where: { slug, status: 'published' },
      include: {
        translations: true,
        discipline: { include: { translations: true } },
        prices: { include: { plan: true } },
        sections: {
          where: { status: { not: 'archived' } },
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: true,
            lessons: {
              where: { status: { not: 'archived' } },
              orderBy: { sortOrder: 'asc' },
              include: {
                translations: true,
                tests: { where: { isActive: true }, select: { id: true, title: true } },
                videos: {
                  select: { originalName: true, updatedAt: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    return {
      ...course,
      sections: course.sections.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) => {
          const video = lesson.videos[0];
          const { videos: _videos, ...rest } = lesson;
          return {
            ...rest,
            topicTitle: lessonTopicTitle(lesson.translations, video?.originalName, {
              lessonUpdatedAt: lesson.updatedAt,
              videoUpdatedAt: video?.updatedAt,
            }),
          };
        }),
      })),
    };
  }

  @Get('lessons/:id')
  async publicLesson(@Param('id') id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, status: { not: 'archived' }, section: { status: { not: 'archived' }, course: { status: 'published' } } },
      include: {
        translations: true,
        tests: { where: { isActive: true }, select: { id: true, title: true } },
        documents: { include: { document: { select: { id: true, title: true } } } },
        videos: { select: { id: true, status: true, sourceKey: true, originalName: true, updatedAt: true }, orderBy: { createdAt: 'desc' } },
        section: { include: { course: { select: { id: true, slug: true } } } },
      },
    });
    if (!lesson) throw new AppException('LESSON_NOT_FOUND', 'Lesson not found');
    const playable = lesson.videos.find((video) => video.sourceKey || video.status === 'READY' || video.status === 'PROCESSING')
      ?? lesson.videos[0];
    return {
      id: lesson.id,
      isFreePreview: lesson.isFreePreview,
      translations: lesson.translations,
      tests: lesson.tests,
      course: lesson.section.course,
      hasPdf: lesson.documents.length > 0,
      hasVideo: Boolean(playable),
      videoId: playable?.id ?? null,
      topicTitle: lessonTopicTitle(lesson.translations, playable?.originalName, {
        lessonUpdatedAt: lesson.updatedAt,
        videoUpdatedAt: playable?.updatedAt,
      }),
      demoVideoUrl: '',
      demoPdfUrl: '/notes/lesson-demo.pdf',
    };
  }

  @Post('lessons/:id/playback-session')
  async publicPlaybackSession(@Param('id') id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, status: { not: 'archived' }, section: { status: { not: 'archived' }, course: { status: 'published' } } },
      include: { videos: { orderBy: { createdAt: 'desc' } } },
    });
    if (!lesson) throw new AppException('LESSON_NOT_FOUND', 'Lesson not found', HttpStatus.NOT_FOUND);
    const video = lesson.videos.find((item) => item.sourceKey) ?? lesson.videos[0];
    if (!video) throw new AppException('VIDEO_NOT_FOUND', 'Lesson video is not attached', HttpStatus.NOT_FOUND);
    return this.sessions.playback(video.id, 'public-lesson');
  }

  @Post('lessons/:id/notes-session')
  async publicNotesSession(@Param('id') id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, status: { not: 'archived' }, section: { status: { not: 'archived' }, course: { status: 'published' } } },
      include: { documents: { orderBy: { documentId: 'asc' } } },
    });
    if (!lesson) throw new AppException('LESSON_NOT_FOUND', 'Lesson not found', HttpStatus.NOT_FOUND);
    const documentId = lesson.documents[0]?.documentId;
    if (!documentId) throw new AppException('PDF_NOT_FOUND', 'PDF notes are not attached', HttpStatus.NOT_FOUND);
    return this.sessions.viewPdf(documentId, 'public-notes');
  }

  @Get('lessons/:id/test')
  async publicLessonTest(@Param('id') id: string, @Query('lang') lang?: string) {
    const { test, language } = await this.loadPublicLessonTest(id, lang);
    const questions = test.pool
      .map((item) => item.question)
      .filter((question) => question.isActive)
      .slice(0, test.questionCount);
    if (questions.length === 0) {
      throw new AppException('TEST_EMPTY', 'Question pool is empty', HttpStatus.NOT_FOUND);
    }
    return {
      testId: test.id,
      title: test.title,
      questionCount: questions.length,
      questions: questions.map((question) => {
        const translation =
          question.translations.find((row) => row.language === language) ?? question.translations[0];
        return {
          id: question.id,
          prompt: translation?.prompt ?? '',
          options: question.options
            .slice()
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((option) => ({
              id: option.code,
              text:
                option.translations.find((row) => row.language === language)?.text ??
                option.translations[0]?.text ??
                option.code,
            })),
        };
      }),
    };
  }

  @Post('lessons/:id/test/grade')
  async gradePublicLessonTest(
    @Param('id') id: string,
    @Body() body: GradePublicTestDto,
  ) {
    const { test } = await this.loadPublicLessonTest(id);
    const questions = test.pool
      .map((item) => item.question)
      .filter((question) => question.isActive)
      .slice(0, test.questionCount);
    const answers = new Map(body.answers.map((item) => [item.questionId, item.selectedCode]));
    let correctCount = 0;
    for (const question of questions) {
      const selected = answers.get(question.id);
      const correct = question.options.find((option) => option.isCorrect)?.code;
      if (selected && correct && selected === correct) correctCount += 1;
    }
    return gradeAttempt(correctCount, questions.length);
  }

  @Get('account-deletion')
  accountDeletion() {
    return {
      inApp: true,
      webPath: '/account-deletion',
      removes: ['phone', 'pin', 'devices', 'push tokens', 'display name'],
      retains: ['anonymized payment facts'],
    };
  }

  @Get('offer')
  async offer() {
    const [courses, plans] = await Promise.all([
      this.prisma.course.findMany({
        where: { status: 'published' },
        include: {
          translations: true,
          prices: { include: { plan: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.plan.findMany({ orderBy: { durationDays: 'asc' } }),
    ]);
    const offer = buildOffer({ courses, plans });
    return { ...offer, year3Bundle: year3BundleFromOffer(offer.courses) };
  }

  @Get('payment-methods')
  paymentMethods() {
    return publicPaymentMethods();
  }

  @Get('store-products')
  async storeProducts() {
    const plans = await this.prisma.plan.findMany({ orderBy: { durationDays: 'asc' } });
    return {
      grantsAccess: false,
      sources: ['GOOGLE_PLAY', 'APPLE_IAP'],
      plans: plans.map((plan) => ({
        planCode: plan.code,
        durationDays: plan.durationDays,
        ...storeSku(plan.code),
      })),
    };
  }

  @Get('courses/:id/preview')
  preview(@Param('id') id: string) {
    return this.prisma.lesson.findMany({
      where: {
        isFreePreview: true,
        status: 'published',
        section: { courseId: id, status: 'published' },
      },
      include: { translations: true, section: true },
    });
  }

  private async loadPublicLessonTest(lessonId: string, lang?: string) {
    const language = lang === 'tg' || lang === 'en' || lang === 'ru' ? lang : 'ru';
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: 'published',
        section: { status: 'published', course: { status: 'published' } },
      },
      include: {
        tests: {
          where: { isActive: true },
          take: 1,
          include: {
            pool: {
              include: {
                question: { include: { translations: true, options: { include: { translations: true } } } },
              },
            },
          },
        },
      },
    });
    if (!lesson) throw new AppException('LESSON_NOT_FOUND', 'Lesson not found', HttpStatus.NOT_FOUND);
    const test = lesson.tests[0];
    if (!test) throw new AppException('TEST_NOT_FOUND', 'Test not found', HttpStatus.NOT_FOUND);
    return { lesson, test, language };
  }
}

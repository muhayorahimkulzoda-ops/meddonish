import { Injectable } from '@nestjs/common';
import { Language, Prisma, PublishStatus } from '@prisma/client';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from './audit.service';
import {
  CreateCourseDto,
  CreateDisciplineDto,
  CreateLessonDto,
  CreateSectionDto,
  CoursePriceDto,
  TranslationDto,
  UpdateCourseDto,
  UpdateDisciplineDto,
  UpdateLessonDto,
  UpdateSectionDto,
  ReplaceLessonTimecodesDto,
} from './cms.dto';

const courseInclude = {
  translations: true,
  discipline: { include: { translations: true } },
  prices: { include: { plan: true } },
  sections: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      translations: true,
      lessons: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          translations: true,
          videos: {
            orderBy: { createdAt: 'desc' as const },
            include: { variants: true },
          },
          documents: { include: { document: true } },
          tests: { select: { id: true, title: true, _count: { select: { pool: true } } } },
        },
      },
    },
  },
};

@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  dashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.entitlement.count({ where: { status: 'active' } }),
      this.prisma.course.count(),
      this.prisma.lesson.count(),
      this.prisma.discipline.count(),
      this.prisma.clinicalCase.count(),
      this.prisma.situationalTask.count(),
      this.prisma.order.count(),
      this.prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
      this.prisma.order.count({ where: { status: { in: ['created', 'pending'] } } }),
      this.prisma.entitlement.count({
        where: { status: 'active', expiresAt: { gte: now, lte: inSevenDays } },
      }),
      this.prisma.question.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.securityEvent.count(),
    ]).then(([
      users,
      activeUsers,
      activeEntitlements,
      courses,
      lessons,
      disciplines,
      clinicalCases,
      simpleCases,
      orders,
      activeLast7Days,
      pendingPayments,
      expiringIn7Days,
      newQuestions,
      suspiciousEvents,
    ]) => ({
      users,
      activeUsers,
      activeEntitlements,
      courses,
      lessons,
      disciplines,
      clinicalCases,
      simpleCases,
      orders,
      activeLast7Days,
      pendingPayments,
      expiringIn7Days,
      newQuestions,
      suspiciousEvents,
    }));
  }

  listDisciplines() {
    return this.prisma.discipline.findMany({
      include: { translations: true, _count: { select: { courses: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createDiscipline(adminId: string, dto: CreateDisciplineDto, ip?: string) {
    const discipline = await this.prisma.discipline.create({
      data: {
        slug: dto.slug,
        status: dto.status ?? PublishStatus.draft,
        sortOrder: dto.sortOrder ?? 0,
        translations: { create: dto.translations.map(toDisciplineTranslation) },
      },
      include: { translations: true },
    }).catch(rethrowPrisma);
    await this.audit.log({
      adminId,
      action: 'create',
      entity: 'discipline',
      entityId: discipline.id,
      ip,
    });
    return discipline;
  }

  async updateDiscipline(adminId: string, id: string, dto: UpdateDisciplineDto, ip?: string) {
    const discipline = await this.prisma.discipline.update({
      where: { id },
      data: {
        status: dto.status,
        sortOrder: dto.sortOrder,
        ...(dto.translations
          ? {
              translations: {
                deleteMany: {},
                create: dto.translations.map(toDisciplineTranslation),
              },
            }
          : {}),
      },
      include: { translations: true },
    });
    await this.audit.log({
      adminId,
      action: 'update',
      entity: 'discipline',
      entityId: id,
      ip,
    });
    return discipline;
  }

  listCourses() {
    return this.prisma.course.findMany({
      include: {
        translations: true,
        discipline: { include: { translations: true } },
        prices: { include: { plan: true } },
        sections: { select: { _count: { select: { lessons: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getCourse(idOrSlug: string) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
    const course = await this.prisma.course.findUniqueOrThrow({
      where: uuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: courseInclude,
    });
    return JSON.parse(
      JSON.stringify(course, (key, value) => {
        if (typeof value === 'bigint') return Number(value);
        if (key === 'sourceKey' || key === 'storageKey' || key === 'manifestKey') return undefined;
        return value;
      }),
    );
  }

  async createCourse(adminId: string, dto: CreateCourseDto, ip?: string) {
    const prices = await this.resolvePrices(dto.prices);
    const course = await this.prisma.course.create({
      data: {
        disciplineId: dto.disciplineId,
        slug: dto.slug,
        coverUrl: dto.coverUrl,
        instructor: dto.instructor,
        language: dto.language ?? Language.ru,
        status: dto.status ?? PublishStatus.draft,
        translations: { create: dto.translations.map(toCourseTranslation) },
        prices: { create: prices },
      },
      include: courseInclude,
    }).catch(rethrowPrisma);
    await this.audit.log({
      adminId,
      action: 'create',
      entity: 'course',
      entityId: course.id,
      ip,
    });
    return course;
  }

  async updateCourse(adminId: string, id: string, dto: UpdateCourseDto, ip?: string) {
    const prices = dto.prices ? await this.resolvePrices(dto.prices) : undefined;
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        disciplineId: dto.disciplineId,
        coverUrl: dto.coverUrl,
        instructor: dto.instructor,
        language: dto.language,
        status: dto.status,
        ...(dto.translations
          ? {
              translations: {
                deleteMany: {},
                create: dto.translations.map(toCourseTranslation),
              },
            }
          : {}),
        ...(prices
          ? {
              prices: {
                deleteMany: {},
                create: prices,
              },
            }
          : {}),
      },
      include: courseInclude,
    });
    await this.audit.log({
      adminId,
      action: dto.status === 'published' ? 'publish' : 'update',
      entity: 'course',
      entityId: id,
      ip,
    });
    if (dto.status === PublishStatus.published) {
      const title = course.translations.find((row) => row.language === Language.ru)?.title;
      await this.notifications.announce('new_course', {
        title: title ? `Новый курс: ${title}` : undefined,
        extra: course.id,
      });
    }
    return course;
  }

  async createSection(adminId: string, courseId: string, dto: CreateSectionDto, ip?: string) {
    const section = await this.prisma.section.create({
      data: {
        courseId,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? PublishStatus.draft,
        translations: { create: dto.translations.map(toSectionTranslation) },
      },
      include: { translations: true, lessons: { include: { translations: true } } },
    });
    await this.audit.log({
      adminId,
      action: 'create',
      entity: 'section',
      entityId: section.id,
      ip,
    });
    return section;
  }

  async updateSection(adminId: string, id: string, dto: UpdateSectionDto, ip?: string) {
    const section = await this.prisma.section.update({
      where: { id },
      data: {
        sortOrder: dto.sortOrder,
        status: dto.status,
        ...(dto.translations
          ? {
              translations: {
                deleteMany: {},
                create: dto.translations.map(toSectionTranslation),
              },
            }
          : {}),
      },
      include: {
        translations: true,
        lessons: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
      },
    });
    await this.audit.log({
      adminId,
      action: 'update',
      entity: 'section',
      entityId: id,
      ip,
    });
    return section;
  }

  async createLesson(adminId: string, sectionId: string, dto: CreateLessonDto, ip?: string) {
    if (dto.isFreePreview) {
      await this.enforcePreviewLimit(sectionId);
    }
    const lesson = await this.prisma.lesson.create({
      data: {
        sectionId,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? PublishStatus.published,
        isFreePreview: dto.isFreePreview ?? false,
        durationSec: dto.durationSec,
        translations: { create: dto.translations.map(toLessonTranslation) },
      },
      include: { translations: true },
    });
    await this.audit.log({
      adminId,
      action: 'create',
      entity: 'lesson',
      entityId: lesson.id,
      ip,
    });
    if (lesson.status === PublishStatus.published) {
      const section = await this.prisma.section.findUniqueOrThrow({
        where: { id: sectionId },
        select: { courseId: true },
      });
      await this.notifications.announce('new_lesson', {
        extra: lesson.id,
        courseId: section.courseId,
      });
    }
    return lesson;
  }

  async deleteLesson(adminId: string, id: string, ip?: string) {
    await this.prisma.lesson.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.question.updateMany({ where: { lessonId: id }, data: { lessonId: null } }),
      this.prisma.test.updateMany({ where: { lessonId: id }, data: { lessonId: null } }),
      this.prisma.lesson.delete({ where: { id } }),
    ]);
    await this.audit.log({
      adminId,
      action: 'delete',
      entity: 'lesson',
      entityId: id,
      ip,
    });
    return { id, deleted: true };
  }

  listTimecodes(lessonId: string) {
    return this.prisma.lessonTimecode.findMany({
      where: { lessonId },
      orderBy: [{ offsetSec: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async replaceTimecodes(adminId: string, lessonId: string, dto: ReplaceLessonTimecodesDto, ip?: string) {
    await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    await this.prisma.$transaction([
      this.prisma.lessonTimecode.deleteMany({ where: { lessonId } }),
      ...dto.items.map((item, index) =>
        this.prisma.lessonTimecode.create({
          data: {
            lessonId,
            prompt: item.prompt.trim(),
            offsetSec: item.offsetSec,
            sortOrder: index,
          },
        }),
      ),
    ]);
    await this.audit.log({
      adminId,
      action: 'update',
      entity: 'lesson_timecodes',
      entityId: lessonId,
      ip,
    });
    return this.listTimecodes(lessonId);
  }

  async updateLesson(adminId: string, id: string, dto: UpdateLessonDto, ip?: string) {
    const current = await this.prisma.lesson.findUniqueOrThrow({ where: { id } });
    if (dto.isFreePreview && !current.isFreePreview) {
      await this.enforcePreviewLimit(dto.sectionId ?? current.sectionId, id);
    }
    const lesson = await this.prisma.lesson.update({
      where: { id },
      data: {
        sectionId: dto.sectionId,
        sortOrder: dto.sortOrder,
        status: dto.status,
        isFreePreview: dto.isFreePreview,
        durationSec: dto.durationSec,
      },
      include: { translations: true },
    });
    if (dto.translations) {
      for (const item of dto.translations) {
        await this.prisma.lessonTranslation.upsert({
          where: { lessonId_language: { lessonId: id, language: item.language } },
          create: { lessonId: id, ...toLessonTranslation(item) },
          update: {
            title: item.title,
            ...(item.body !== undefined ? { body: item.body } : {}),
          },
        });
      }
    }
    await this.audit.log({
      adminId,
      action: 'update',
      entity: 'lesson',
      entityId: id,
      ip,
    });
    if (dto.status === PublishStatus.published && current.status !== PublishStatus.published) {
      const section = await this.prisma.section.findUniqueOrThrow({
        where: { id: lesson.sectionId },
        select: { courseId: true },
      });
      await this.notifications.announce('new_lesson', {
        extra: lesson.id,
        courseId: section.courseId,
      });
    }
    return this.prisma.lesson.findUniqueOrThrow({ where: { id }, include: { translations: true } });
  }

  private async enforcePreviewLimit(sectionId: string, exceptLessonId?: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key: 'free_preview_limit' },
    });
    const limit = typeof setting?.value === 'number' ? setting.value : 1;
    const section = await this.prisma.section.findUniqueOrThrow({
      where: { id: sectionId },
      select: { courseId: true },
    });
    const count = await this.prisma.lesson.count({
      where: {
        isFreePreview: true,
        id: exceptLessonId ? { not: exceptLessonId } : undefined,
        section: { courseId: section.courseId },
      },
    });
    if (count >= limit) {
      throw new AppException(
        'PREVIEW_LIMIT',
        `Free preview limit for this course is ${limit}`,
      );
    }
  }

  private async resolvePrices(prices: CoursePriceDto[]) {
    const codes = [...new Set(prices.map((price) => price.planCode))];
    if (codes.length !== 3) {
      throw new AppException('PLAN_REQUIRED', 'Course must have prices for 1, 5 and 12 months');
    }
    const plans = await this.prisma.plan.findMany({ where: { code: { in: codes } } });
    return prices.map((price) => {
      const plan = plans.find((item) => item.code === price.planCode);
      if (!plan) throw new AppException('PLAN_NOT_FOUND', `Plan ${price.planCode} is missing`);
      return {
        planId: plan.id,
        amountMinor: price.amountMinor,
        currency: price.currency ?? 'TJS',
      };
    });
  }
}

function rethrowPrisma(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppException('DUPLICATE', 'A record with this slug already exists');
  }
  throw error;
}

function toDisciplineTranslation(item: TranslationDto): Prisma.DisciplineTranslationCreateWithoutDisciplineInput {
  return { language: item.language, title: item.title, description: item.description ?? '' };
}

function toCourseTranslation(item: TranslationDto): Prisma.CourseTranslationCreateWithoutCourseInput {
  return { language: item.language, title: item.title, description: item.description ?? '' };
}

function toSectionTranslation(item: TranslationDto): Prisma.SectionTranslationCreateWithoutSectionInput {
  return { language: item.language, title: item.title };
}

function toLessonTranslation(item: TranslationDto): Prisma.LessonTranslationCreateWithoutLessonInput {
  return { language: item.language, title: item.title, body: item.body ?? null };
}

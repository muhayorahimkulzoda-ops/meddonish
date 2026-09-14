'use client';

import { useLocale, t } from '../lib/i18n';
import { Shell } from '../components/Shell';
import { GlobalSearch } from '../components/GlobalSearch';
import { QuickActions } from '../components/QuickActions';
import { ContinueLearning } from '../components/ContinueLearning';
import { CourseCard } from '../components/CourseCard';
import { SectionHeader } from '../components/SectionHeader';

const COURSES = [
  {
    href: '/courses/anatomy-osteo',
    titleKey: 'home.track.anatomy' as const,
    descriptionKey: 'course.anatomy.lead' as const,
    lectures: 24,
    tests: 12,
  },
  {
    href: '/courses/pharmacology-y3',
    titleKey: 'home.track.pharma' as const,
    descriptionKey: 'home.year3' as const,
    lectures: 18,
    tests: 10,
  },
  {
    href: '/courses/pathophysiology-y3',
    titleKey: 'home.track.pathphys' as const,
    descriptionKey: 'home.year3' as const,
    lectures: 18,
    tests: 10,
  },
  {
    href: '/courses/pathanatomy-y3',
    titleKey: 'home.track.pathanat' as const,
    descriptionKey: 'home.year3' as const,
    lectures: 18,
    tests: 10,
  },
];

export default function HomePage() {
  useLocale();

  return (
    <Shell>
      <section className="md-home">
        <div className="md-home-hero">
          <p className="md-kicker">MEDdonish</p>
          <h1>{t('home.app.subtitle')}</h1>
        </div>
        <GlobalSearch size="lg" />
        <QuickActions />
        <ContinueLearning />
        <section className="md-block" id="year3">
          <SectionHeader title={t('nav.courses')} />
          <div className="md-course-grid">
            {COURSES.map((course) => (
              <CourseCard
                key={course.href}
                href={course.href}
                title={t(course.titleKey)}
                description={t(course.descriptionKey)}
                lectures={course.lectures}
                tests={course.tests}
                started={course.href.includes('anatomy')}
              />
            ))}
          </div>
        </section>
      </section>
    </Shell>
  );
}

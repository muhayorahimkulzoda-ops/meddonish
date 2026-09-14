'use client';

import { useEffect, useState } from 'react';
import type { MessageKey } from '@meddonish/localization';
import { t, useLocale } from '../lib/i18n';
import { Shell } from '../components/Shell';
import { LocaleSwitch } from '../components/LocaleSwitch';
import { BrandMark } from '../components/BrandMark';
import { HomeStage, type StageSlide } from '../components/HomeStage';

const YEAR1: { key: MessageKey; href: string; icon: 'anatomy' } = {
  key: 'home.track.anatomy',
  href: '/courses/anatomy-osteo',
  icon: 'anatomy',
};

const TRACKS: { key: MessageKey; href: string; icon: 'pharma' | 'pathphys' | 'pathanat' }[] = [
  { key: 'home.track.pharma', href: '/courses/pharmacology-y3', icon: 'pharma' },
  { key: 'home.track.pathphys', href: '/courses/pathophysiology-y3', icon: 'pathphys' },
  { key: 'home.track.pathanat', href: '/courses/pathanatomy-y3', icon: 'pathanat' },
];

function TrackIcon({ name }: { name: 'anatomy' | 'pharma' | 'pathphys' | 'pathanat' }) {
  if (name === 'anatomy') {
    return (
      <>
        <span className="anatomy-panel">
          <img src="/images/track-anatomy-skeleton.png" alt="" />
        </span>
        <span className="anatomy-panel">
          <img src="/images/track-anatomy-nerves.png" alt="" />
        </span>
        <span className="anatomy-panel">
          <img src="/images/track-anatomy-vessels.png" alt="" />
        </span>
      </>
    );
  }
  if (name === 'pharma') {
    return <img src="/images/track-pharma.png" alt="" />;
  }
  if (name === 'pathphys') {
    return <img src="/images/track-pathphys.jpg" alt="" />;
  }
  return <img src="/images/track-pathanat.jpg" alt="" />;
}

export default function HomePage() {
  useLocale();
  const [hash, setHash] = useState('');

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const showCatalog = hash === '#year3';
  const year1Slides: StageSlide[] = [
    {
      kind: 'media',
      image: '/images/track-anatomy-skeleton.png',
      kicker: t('home.stage.videos'),
      title: t('home.track.anatomy'),
      lead: t('home.stage.videosLead'),
    },
    {
      kind: 'notes',
      image: '/images/track-anatomy-nerves.png',
      kicker: t('home.stage.notes'),
      title: t('home.stage.notes'),
      lead: t('home.stage.notesLead'),
    },
    {
      kind: 'tests',
      image: '/images/track-anatomy-vessels.png',
      kicker: t('home.stage.tests'),
      title: t('home.stage.tests'),
      lead: t('home.stage.testsLead'),
    },
  ];
  const year3Slides: StageSlide[] = [
    {
      kind: 'media',
      image: '/images/track-pharma.png',
      kicker: t('home.year3'),
      title: t('home.track.pharma'),
      lead: t('home.stage.videosLead'),
    },
    {
      kind: 'media',
      image: '/images/track-pathphys.jpg',
      kicker: t('home.year3'),
      title: t('home.track.pathphys'),
      lead: t('home.stage.videosLead'),
    },
    {
      kind: 'media',
      image: '/images/track-pathanat.jpg',
      kicker: t('home.year3'),
      title: t('home.track.pathanat'),
      lead: t('home.stage.videosLead'),
    },
    {
      kind: 'notes',
      kicker: t('home.stage.notes'),
      title: t('home.stage.notes'),
      lead: t('home.stage.y3notesLead'),
    },
    {
      kind: 'tests',
      kicker: t('home.stage.tests'),
      title: t('home.stage.tests'),
      lead: t('home.stage.y3testsLead'),
    },
  ];

  const catalog = (
    <>
      <p className="year-kicker" id="year1">
        {t('home.year1')}
      </p>
      <div className="track-grid track-grid-year1">
        <a className={`track-card track-${YEAR1.icon}`} href={YEAR1.href}>
          <span className="track-icon">
            <TrackIcon name={YEAR1.icon} />
          </span>
          <strong>{t(YEAR1.key)}</strong>
        </a>
      </div>

      <p className="year-kicker" id="year3">
        {t('home.year3')}
      </p>
      <div className="track-grid">
        {TRACKS.map((track) => (
          <a className={`track-card track-${track.icon}`} href={track.href} key={track.key}>
            <span className="track-icon">
              <TrackIcon name={track.icon} />
            </span>
            <strong>{t(track.key)}</strong>
          </a>
        ))}
      </div>
    </>
  );

  return (
    <Shell>
      <section className="landing">
        <div className="landing-copy">
          <div className="landing-top">
            <p className="landing-brand">
              <BrandMark />
            </p>
            <LocaleSwitch className="landing-lang locale-switch" />
          </div>
          <h1 className="landing-title">
            {t('home.headline')} <span>{t('home.fromDoctor')}</span>
          </h1>
          <p className="landing-lead">{t('home.hero.subtitle')}</p>

          {showCatalog ? (
            catalog
          ) : (
            <>
              <ul className="home-motto">
                <li>{t('home.motivate.1')}</li>
                <li>{t('home.motivate.2')}</li>
                <li>{t('home.motivate.3')}</li>
              </ul>
              <p className="year-kicker">{t('home.year1')}</p>
              <HomeStage slides={year1Slides} href={YEAR1.href} label={t('home.track.anatomy')} />
              <p className="year-kicker">{t('home.year3')}</p>
              <HomeStage slides={year3Slides} href="#year3" label={t('home.year3')} />
            </>
          )}

          <div className="landing-actions">
            <a className="cta-primary" href="#year3">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9.2 12 5l8 4.2v2.2L12 7.2 4 11.4V9.2Z" />
                <path d="M6.2 12.2v4.1c0 .4 2.5 2.2 5.8 2.2s5.8-1.8 5.8-2.2v-4.1" />
                <path d="M12 12.6v5.6" />
              </svg>
              {t('home.viewCourses')}
            </a>
            <a className="cta-secondary" href="/register">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8.2" r="3.2" />
                <path d="M6.4 18.2c.8-2.8 2.9-4.2 5.6-4.2s4.8 1.4 5.6 4.2" />
                <path d="M17.4 10.2v3.4M15.7 11.9h3.4" />
              </svg>
              {t('home.createAccount')}
            </a>
          </div>
        </div>
      </section>
    </Shell>
  );
}

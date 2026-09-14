'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, mediaUrl } from '../../../../lib/api';
import { t, useLocale } from '../../../../lib/i18n';
import { Shell } from '../../../../components/Shell';
import { LessonMemo } from '../../../../components/LessonMemo';
import { LessonPdfViewer } from '../../../../components/LessonPdfViewer';
import { LessonTestViewer } from '../../../../components/LessonTestViewer';
import { writeContinueLesson } from '../../../../lib/continue-learning';

type Lesson = {
  id: string;
  translations: { language: string; title: string; body?: string | null }[];
  tests: { id: string; title: string }[];
  course: { id: string; slug: string };
  hasPdf?: boolean;
  hasVideo?: boolean;
  videoId?: string | null;
  topicTitle?: string;
};

function pick(
  items: { language: string; title: string; body?: string | null }[] | undefined,
  locale: string,
  field: 'title' | 'body' = 'title',
) {
  const hit =
    items?.find((item) => item.language === 'tg') ??
    items?.find((item) => item.language === locale) ??
    items?.find((item) => item.language === 'ru') ??
    items?.[0];
  return (hit?.[field] ?? '') as string;
}

export default function LearnLessonPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState('');
  const [showPdf, setShowPdf] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [videoSrc, setVideoSrc] = useState('');

  useEffect(() => {
    api<Lesson>(`/public/lessons/${params.id}`)
      .then(setLesson)
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;
    api<{ playbackUrl: string }>(`/public/lessons/${lesson.id}/playback-session`, { method: 'POST' })
      .then((session) => {
        if (!cancelled) setVideoSrc(mediaUrl(session.playbackUrl));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson]);

  const title = lesson?.topicTitle || pick(lesson?.translations, locale);
  const notes = pick(lesson?.translations, locale, 'body');
  const test = lesson?.tests[0];
  const backHref = lesson?.course.slug ? `/courses/${lesson.course.slug}` : '/courses/anatomy-osteo';

  useEffect(() => {
    if (!lesson) return;
    writeContinueLesson({
      courseTitle: lesson.course.slug === 'anatomy-osteo' ? t('home.track.anatomy') : lesson.course.slug,
      topicTitle: title || t('course.topics'),
      href: `/learn/lessons/${lesson.id}`,
      progress: 0,
    });
  }, [lesson, title]);

  async function openPdf() {
    if (!lesson) return;
    setError('');
    if (lesson.hasPdf) {
      try {
        const session = await api<{ viewUrl: string }>(`/public/lessons/${lesson.id}/notes-session`, {
          method: 'POST',
        });
        setPdfUrl(mediaUrl(session.viewUrl));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
        return;
      }
    } else {
      setPdfUrl('');
    }
    setShowPdf(true);
  }

  function openTest() {
    if (!test) return;
    setShowTest(true);
  }

  return (
    <Shell>
      <a href={backHref}>{t('home.track.anatomy')}</a>
      <section className="hero">
        <h1>{title || '...'}</h1>
      </section>
      {error ? <p className="error">{error}</p> : null}

      <div className="lesson-player">
        {videoSrc ? (
          <video
            className="player"
            controls
            playsInline
            preload="auto"
            src={videoSrc}
            onError={() => {
              if (videoSrc.includes(':3000/')) {
                setVideoSrc(videoSrc.replace(/https?:\/\/[^/]+:3000/, ''));
              }
            }}
          />
        ) : (
          <div className="player" />
        )}
      </div>

      <div className="lesson-tools">
        <div className="lesson-col-pdf">
          <button className="button tool-pdf" type="button" onClick={() => void openPdf()}>
            {t('lesson.pdf')}
          </button>
          {lesson ? <LessonMemo lessonId={lesson.id} /> : null}
        </div>
        <button className="button tool-test" type="button" disabled={!test} onClick={openTest}>
          {t('lesson.test')}
        </button>
      </div>

      {showPdf ? (
        <LessonPdfViewer
          title={title}
          notes={notes}
          pdfUrl={pdfUrl}
          onClose={() => {
            setShowPdf(false);
            setPdfUrl('');
          }}
        />
      ) : null}
      {showTest && lesson ? <LessonTestViewer lessonId={lesson.id} onClose={() => setShowTest(false)} /> : null}
    </Shell>
  );
}

'use client';

import { FormEvent, useState } from 'react';
import { t, useLocale } from '../../lib/i18n';
import { Shell } from '../../components/Shell';
import { AIQuickPrompt } from '../../components/AIQuickPrompt';

export default function AiPage() {
  useLocale();
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(t('ai.disclaimer'));
  }

  const prompts = [t('ai.explain'), t('ai.summarize'), t('ai.test'), t('ai.clinical'), t('ai.latin')];

  return (
    <Shell>
      <section className="md-page md-ai">
        <h1>{t('ai.title')}</h1>
        <p className="md-lead">{t('ai.lead')}</p>
        <form className="md-ai-form" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="ai-q">
            {t('ai.placeholder')}
          </label>
          <textarea
            id="ai-q"
            rows={4}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t('ai.placeholder')}
          />
          <button type="submit" className="md-btn md-btn-primary">
            {t('ai.send')}
          </button>
        </form>
        <div className="md-chips">
          {prompts.map((label) => (
            <AIQuickPrompt key={label} label={label} onPick={(value) => setQuestion(value)} />
          ))}
        </div>
        {notice ? <p className="md-note">{notice}</p> : null}
      </section>
    </Shell>
  );
}

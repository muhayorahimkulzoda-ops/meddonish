'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { captureAdminGateFromUrl, fetchMe, getAdminOrigin, hasAdminGate, logoutSession } from '../lib/api';
import { t, useLocale } from '../lib/i18n';
import { LocaleSwitch } from './LocaleSwitch';
import { BrandMark } from './BrandMark';

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 11.2 12 5l7.5 6.2V19a1.4 1.4 0 0 1-1.4 1.4h-4.2v-5.2h-3.8V20.4H5.9A1.4 1.4 0 0 1 4.5 19v-7.8Z" />
    </svg>
  );
}

function IconCourses() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.4c1.8-.8 3.8-.8 5.8 0v11.2c-1.8-.8-3.8-.8-5.8 0V6.4Z" />
      <path d="M13.2 6.4c1.8-.8 3.8-.8 5.8 0v11.2c-1.8-.8-3.8-.8-5.8 0V6.4Z" />
    </svg>
  );
}

function IconPlans() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 5.2h7.6l2.4 3.4v10.2A1.6 1.6 0 0 1 16.6 20.4H7.4A1.6 1.6 0 0 1 5.8 18.8V8.6l2.4-3.4Z" />
      <path d="M9.2 12.4h5.6M12 9.6v5.6" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.1" />
      <path d="M6.4 18.4c.9-2.7 2.9-4.1 5.6-4.1s4.7 1.4 5.6 4.1" />
    </svg>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [hash, setHash] = useState('');

  useEffect(() => {
    captureAdminGateFromUrl();
    setShowAdmin(hasAdminGate());
    void fetchMe().then((user) => {
      setLoggedIn(Boolean(user));
      const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.displayName || '';
      setDisplayName(name);
    });
  }, [pathname]);

  const coursesHref = '/#year3';
  const accountHref = loggedIn ? '/profile' : '/signin';

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [pathname]);

  const homeActive = pathname === '/' && hash !== '#year3';
  const coursesActive =
    hash === '#year3' || pathname.startsWith('/courses') || pathname.startsWith('/learn/lessons');

  const hideChrome =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/signin') ||
    pathname.startsWith('/forgot');
  const hideFooter = hideChrome || pathname.startsWith('/offer');

  return (
    <div className={hideChrome ? 'shell shell-home' : 'shell'} lang={locale}>
      <header className="header">
        <a className="brand" href="/">
          <BrandMark />
        </a>
        <nav className="nav">
          <LocaleSwitch />
          <a href={coursesHref}>{t('nav.courses')}</a>
          <a href="/offer">{t('nav.offer')}</a>
          {loggedIn ? <a href="/notifications">{t('nav.notifications')}</a> : null}
          {loggedIn ? <a href="/profile">{t('nav.profile')}</a> : <a href="/signin">{t('nav.login')}</a>}
          {loggedIn && displayName ? <span className="nav-user">{displayName}</span> : null}
          {showAdmin ? (
            <a className="button admin-entry" href={getAdminOrigin()}>
              {t('nav.admin')}
            </a>
          ) : null}
          {loggedIn ? (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                void logoutSession().then(() => {
                  window.location.href = '/';
                });
              }}
            >
              {t('admin.logout')}
            </button>
          ) : null}
        </nav>
      </header>
      {children}
      {hideFooter ? null : (
        <footer className="footer">
          <a href="/privacy">{t('legal.privacy')}</a>
          <a href="/terms">{t('legal.terms')}</a>
          <a href="/account-deletion">{t('legal.accountDeletion')}</a>
        </footer>
      )}
      <nav className="dock" aria-label={t('nav.home')}>
        <a className={homeActive ? 'active' : undefined} href="/">
          <span className="dock-icon">
            <IconHome />
          </span>
          {t('nav.home')}
        </a>
        <a className={coursesActive ? 'active' : undefined} href={coursesHref}>
          <span className="dock-icon">
            <IconCourses />
          </span>
          {t('nav.courses')}
        </a>
        <a className={pathname.startsWith('/offer') ? 'active' : undefined} href="/offer">
          <span className="dock-icon">
            <IconPlans />
          </span>
          {t('nav.offer')}
        </a>
        <a className={pathname.startsWith('/register') || pathname.startsWith('/signin') || pathname.startsWith('/forgot') || pathname.startsWith('/profile') ? 'active' : undefined} href={accountHref}>
          <span className="dock-icon">
            <IconUser />
          </span>
          {loggedIn ? t('nav.profile') : t('nav.login')}
        </a>
      </nav>
    </div>
  );
}

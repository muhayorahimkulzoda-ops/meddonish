'use client';

import { useEffect } from 'react';

export default function LearnPage() {
  useEffect(() => {
    window.location.replace('/#year3');
  }, []);
  return null;
}

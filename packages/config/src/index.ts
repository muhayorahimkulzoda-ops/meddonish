export const APP_NAME = 'MEDdonish';

export const API_PREFIX = '/api/v1';

export const SETTING_KEYS = {
  grade5Min: 'grade_5_min',
  grade4Min: 'grade_4_min',
  grade3Min: 'grade_3_min',
  passMin: 'pass_min',
  videoCompletedPercent: 'video_completed_percent',
  freePreviewLimit: 'free_preview_limit',
  singleDevicePolicy: 'single_device_policy',
  defaultQuestionCount: 'default_question_count',
  secondsPerQuestion: 'seconds_per_question',
} as const;

export const STORAGE_KEYS = {
  videoSource: (id: string) => `video/${id}/source/`,
  videoHls: (id: string) => `video/${id}/hls/`,
  videoDash: (id: string) => `video/${id}/dash/`,
  videoThumb: (id: string) => `video/${id}/thumbnail/`,
} as const;

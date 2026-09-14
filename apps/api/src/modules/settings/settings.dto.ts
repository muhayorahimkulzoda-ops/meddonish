import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  grade_5_min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  grade_4_min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  grade_3_min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  pass_min?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  video_completed_percent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  free_preview_limit?: number;

  @IsOptional()
  @IsIn(['require_release', 'auto_revoke'])
  single_device_policy?: 'require_release' | 'auto_revoke';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  default_question_count?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  seconds_per_question?: number;
}

export class TotpCodeDto {
  @IsString()
  @Matches(/^\d{6}$/)
  totp: string;
}

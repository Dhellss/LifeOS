-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HabitFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('TASK', 'STUDY', 'FITNESS', 'PERSONAL', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('GREAT', 'GOOD', 'NEUTRAL', 'LOW', 'BAD');

-- CreateEnum
CREATE TYPE "XPEventType" AS ENUM ('TASK_COMPLETED', 'PROJECT_COMPLETED', 'HABIT_CHECKIN', 'STUDY_SESSION', 'WORKOUT_LOGGED', 'JOURNAL_ENTRY', 'ACHIEVEMENT_UNLOCKED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "dailyTaskGoal" INTEGER NOT NULL DEFAULT 5,
    "weeklyStudyGoal" INTEGER NOT NULL DEFAULT 600,
    "weeklyWorkoutGoal" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "color" TEXT,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "HabitFrequency" NOT NULL DEFAULT 'DAILY',
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_log" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "notes" TEXT,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workoutDate" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercise" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 1,
    "reps" INTEGER,
    "weight" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workout_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "type" "CalendarEventType" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "mood" "Mood",
    "entryDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "XPEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "project_userId_status_idx" ON "project"("userId", "status");

-- CreateIndex
CREATE INDEX "project_userId_createdAt_idx" ON "project"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "task_userId_status_idx" ON "task"("userId", "status");

-- CreateIndex
CREATE INDEX "task_userId_dueDate_idx" ON "task"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "task_userId_completedAt_idx" ON "task"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "task_projectId_idx" ON "task"("projectId");

-- CreateIndex
CREATE INDEX "habit_userId_isActive_idx" ON "habit"("userId", "isActive");

-- CreateIndex
CREATE INDEX "habit_log_userId_date_idx" ON "habit_log"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "habit_log_habitId_date_key" ON "habit_log"("habitId", "date");

-- CreateIndex
CREATE INDEX "study_session_userId_sessionDate_idx" ON "study_session"("userId", "sessionDate");

-- CreateIndex
CREATE INDEX "study_session_userId_subject_idx" ON "study_session"("userId", "subject");

-- CreateIndex
CREATE INDEX "workout_userId_workoutDate_idx" ON "workout"("userId", "workoutDate");

-- CreateIndex
CREATE INDEX "workout_exercise_workoutId_idx" ON "workout_exercise"("workoutId");

-- CreateIndex
CREATE INDEX "calendar_event_userId_startTime_idx" ON "calendar_event"("userId", "startTime");

-- CreateIndex
CREATE INDEX "journal_entry_userId_entryDate_idx" ON "journal_entry"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "xp_event_userId_createdAt_idx" ON "xp_event"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "xp_event_userId_dedupeKey_key" ON "xp_event"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "user_achievement_userId_idx" ON "user_achievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievement_userId_achievementKey_key" ON "user_achievement"("userId", "achievementKey");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit" ADD CONSTRAINT "habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_log" ADD CONSTRAINT "habit_log_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_log" ADD CONSTRAINT "habit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout" ADD CONSTRAINT "workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

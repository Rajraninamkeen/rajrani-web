-- DropIndex
DROP INDEX "user_sessions_refreshTokenHash_idx";

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshTokenHash_key" ON "user_sessions"("refreshTokenHash");


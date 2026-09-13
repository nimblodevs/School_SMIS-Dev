ALTER TABLE "parents" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "parents_email_key" ON "parents"("email");

CREATE TABLE "activation_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activation_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activation_tokens_tokenHash_key" UNIQUE ("tokenHash"),
    CONSTRAINT "activation_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "activation_tokens_userId_expiresAt_idx" ON "activation_tokens"("userId", "expiresAt");
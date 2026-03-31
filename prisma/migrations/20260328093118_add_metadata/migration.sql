-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB;

BEGIN;
ALTER TABLE "Activity" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private', ADD COLUMN "heartRate" JSONB;
CREATE TABLE "WellbeingRecord" (
 "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "profileId" UUID NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE, "kind" TEXT NOT NULL, "data" JSONB NOT NULL,
 "revision" BIGSERIAL NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3));
CREATE INDEX "WellbeingRecord_profileId_kind_createdAt_id_idx" ON "WellbeingRecord"("profileId","kind","createdAt","id");
CREATE INDEX "WellbeingRecord_profileId_revision_idx" ON "WellbeingRecord"("profileId","revision");
CREATE TABLE "FriendInvite" ("code" TEXT PRIMARY KEY,"profileId" UUID NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE,"expiresAt" TIMESTAMP(3) NOT NULL,"used" BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE "Friendship" ("id" UUID PRIMARY KEY,"aId" UUID NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE,"bId" UUID NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE,"requestedBy" UUID NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Friendship_aId_bId_key" ON "Friendship"("aId","bId");
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_visibility_check" CHECK ("visibility" IN ('private','friends'));
COMMIT;

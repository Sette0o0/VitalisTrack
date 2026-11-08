BEGIN;
ALTER TABLE "DailySteps" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE TABLE "MedicalDocument" (
 "id" UUID NOT NULL PRIMARY KEY,
 "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "profileId" UUID NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE,
 "name" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL,
 "sha256" TEXT NOT NULL, "storageName" TEXT NOT NULL,
 "revision" BIGSERIAL NOT NULL UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3)
);
CREATE INDEX "MedicalDocument_userId_profileId_createdAt_id_idx" ON "MedicalDocument"("userId","profileId","createdAt","id");
CREATE INDEX "MedicalDocument_profileId_revision_idx" ON "MedicalDocument"("profileId","revision");
COMMIT;

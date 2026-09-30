-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "projects_owner_id_slug_key" ON "projects"("owner_id", "slug");

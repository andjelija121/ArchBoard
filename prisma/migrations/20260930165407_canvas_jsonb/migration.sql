/*
  Warnings:

  - You are about to drop the column `canvas_json_path` on the `projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "projects" DROP COLUMN "canvas_json_path",
ADD COLUMN     "canvas" JSONB;

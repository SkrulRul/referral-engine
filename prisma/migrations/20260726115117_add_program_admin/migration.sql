-- CreateTable
CREATE TABLE "program_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_admins_email_key" ON "program_admins"("email");

-- CreateIndex
CREATE INDEX "program_admins_organization_id_idx" ON "program_admins"("organization_id");

-- AddForeignKey
ALTER TABLE "program_admins" ADD CONSTRAINT "program_admins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

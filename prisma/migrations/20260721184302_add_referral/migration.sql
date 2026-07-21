-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'converted');

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referral_code_id" TEXT NOT NULL,
    "referee_email" TEXT NOT NULL,
    "referee_name" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referrals_referral_code_id_idx" ON "referrals"("referral_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referral_code_id_referee_email_key" ON "referrals"("referral_code_id", "referee_email");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

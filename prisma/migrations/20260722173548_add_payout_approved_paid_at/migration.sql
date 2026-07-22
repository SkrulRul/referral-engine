-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "paid_at" TIMESTAMP(3);

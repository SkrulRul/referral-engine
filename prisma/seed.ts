import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.referralCode.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.organization.deleteMany();

  console.log('Seeding organizations and campaigns...');
  const acme = await prisma.organization.create({ data: { name: 'Acme Inc' } });
  const globex = await prisma.organization.create({
    data: { name: 'Globex Corp' },
  });

  const acmeActiveCampaign = await prisma.campaign.create({
    data: {
      name: 'Summer Referral Drive',
      startDate: daysFromNow(-30),
      endDate: daysFromNow(30),
      organizationId: acme.id,
    },
  });
  await prisma.campaign.create({
    data: {
      name: 'Black Friday Push',
      startDate: daysFromNow(10),
      endDate: daysFromNow(40),
      organizationId: acme.id,
    },
  });
  await prisma.campaign.create({
    data: {
      name: 'Spring Launch',
      startDate: daysFromNow(-90),
      endDate: daysFromNow(-30),
      organizationId: acme.id,
    },
  });

  const globexActiveCampaign = await prisma.campaign.create({
    data: {
      name: 'Partner Referral Program',
      startDate: daysFromNow(-15),
      endDate: daysFromNow(45),
      organizationId: globex.id,
    },
  });

  console.log('Seeding referral codes for active campaigns...');
  const referrerEmailsByCampaign = [
    {
      campaignId: acmeActiveCampaign.id,
      emails: [
        'alice@acme-customer.com',
        'bob@acme-customer.com',
        'carol@acme-customer.com',
      ],
    },
    {
      campaignId: globexActiveCampaign.id,
      emails: ['dave@globex-partner.com', 'erin@globex-partner.com'],
    },
  ];

  for (const { campaignId, emails } of referrerEmailsByCampaign) {
    for (const referrerEmail of emails) {
      await prisma.referralCode.create({
        data: { code: nanoid(8), campaignId, referrerEmail },
      });
    }
  }

  console.log('Seed complete:', {
    organizations: 2,
    campaigns: 4,
    referralCodes: referrerEmailsByCampaign.reduce(
      (total, { emails }) => total + emails.length,
      0,
    ),
  });
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

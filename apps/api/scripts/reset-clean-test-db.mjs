import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

for (const envFile of ['.env', 'apps/api/.env', '../../.env']) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

const prisma = new PrismaClient();
const password = 'Password123!';
const defaultEmails = ['employer@malta.test', 'contractor@malta.test', 'admin@malta.test'];

async function deleteMarketplaceData() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.chat.deleteMany(),
    prisma.employerReview.deleteMany(),
    prisma.review.deleteMany(),
    prisma.jobCompletion.deleteMany(),
    prisma.contactUnlock.deleteMany(),
    prisma.refundRequest.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.tokenTransaction.deleteMany(),
    prisma.contractorVerification.deleteMany(),
    prisma.contractorPortfolioImage.deleteMany(),
    prisma.offer.deleteMany(),
    prisma.jobImage.deleteMany(),
    prisma.jobRequest.deleteMany(),
  ]);

  const extraUsers = await prisma.user.findMany({
    where: { email: { notIn: defaultEmails } },
    select: { id: true },
  });

  if (extraUsers.length) {
    const ids = extraUsers.map((user) => user.id);
    await prisma.$transaction([
      prisma.userTokenBalance.deleteMany({ where: { userId: { in: ids } } }),
      prisma.userProfile.deleteMany({ where: { userId: { in: ids } } }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  await prisma.$transaction([
    prisma.employerRatingSummary.deleteMany(),
    prisma.contractorRatingSummary.deleteMany(),
  ]);
}

async function upsertUser(input) {
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      passwordHash,
      role: input.role,
      status: 'ACTIVE',
      profile: {
        create: {
          displayName: input.displayName,
          phone: input.phone,
          location: input.location,
          companyName: input.companyName,
          tradeCategories: input.tradeCategories ?? [],
        },
      },
      tokenBalance: {
        create: {
          balance: input.role === UserRole.CONTRACTOR ? 10 : 0,
        },
      },
    },
    update: {
      passwordHash,
      role: input.role,
      status: 'ACTIVE',
      refreshTokenHash: null,
      profile: {
        upsert: {
          create: {
            displayName: input.displayName,
            phone: input.phone,
            location: input.location,
            companyName: input.companyName,
            tradeCategories: input.tradeCategories ?? [],
          },
          update: {
            displayName: input.displayName,
            phone: input.phone,
            location: input.location,
            bio: null,
            avatarUrl: null,
            companyName: input.companyName,
            tradeCategories: input.tradeCategories ?? [],
          },
        },
      },
      tokenBalance: {
        upsert: {
          create: {
            balance: input.role === UserRole.CONTRACTOR ? 10 : 0,
          },
          update: {
            balance: input.role === UserRole.CONTRACTOR ? 10 : 0,
            version: 0,
          },
        },
      },
    },
  });
}

async function seedTokenPackages() {
  await prisma.tokenPackage.createMany({
    data: [
      { title: 'Starter', tokenCount: 5, price: 9.99, currency: 'EUR', isActive: true },
      { title: 'Professional', tokenCount: 20, price: 29.99, currency: 'EUR', isActive: true },
      { title: 'Business', tokenCount: 50, price: 59.99, currency: 'EUR', isActive: true },
    ],
    skipDuplicates: true,
  });
}

async function main() {
  await deleteMarketplaceData();
  await seedTokenPackages();

  await upsertUser({
    email: 'employer@malta.test',
    role: UserRole.EMPLOYER,
    displayName: 'Sarah Borg',
    phone: '+356 9900 1000',
    location: 'Sliema, Malta',
  });

  await upsertUser({
    email: 'contractor@malta.test',
    role: UserRole.CONTRACTOR,
    displayName: 'Mark Azzopardi',
    phone: '+356 9900 2000',
    location: 'Mosta, Malta',
    companyName: 'Azzopardi Electrical',
    tradeCategories: ['Electrical', 'Handyman'],
  });

  await upsertUser({
    email: 'admin@malta.test',
    role: UserRole.ADMIN,
    displayName: 'Marketplace Admin',
    location: 'Valletta, Malta',
  });

  const counts = {
    users: await prisma.user.count(),
    jobs: await prisma.jobRequest.count(),
    offers: await prisma.offer.count(),
    reviews: await prisma.review.count(),
    employerReviews: await prisma.employerReview.count(),
    conversations: await prisma.conversation.count(),
    notifications: await prisma.notification.count(),
  };

  console.info(JSON.stringify({ defaultEmails, password, counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

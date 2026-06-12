import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

for (const envFile of ['.env', 'apps/api/.env', '../../.env']) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

const prisma = new PrismaClient();

const password = 'Password123!';

async function upsertUser(input: {
  email: string;
  role: UserRole;
  displayName: string;
  phone?: string;
  location?: string;
  companyName?: string;
  tradeCategories?: string[];
}) {
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      passwordHash,
      role: input.role,
      profile: {
        create: {
          displayName: input.displayName,
          phone: input.phone,
          location: input.location ?? 'Malta',
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
      profile: {
        upsert: {
          create: {
            displayName: input.displayName,
            phone: input.phone,
            location: input.location ?? 'Malta',
            companyName: input.companyName,
            tradeCategories: input.tradeCategories ?? [],
          },
          update: {
            displayName: input.displayName,
            phone: input.phone,
            location: input.location ?? 'Malta',
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
          },
        },
      },
    },
  });

  return user;
}

async function main() {
  await prisma.tokenPackage.createMany({
    data: [
      { title: 'Starter', tokenCount: 5, price: 9.99 },
      { title: 'Professional', tokenCount: 20, price: 29.99 },
      { title: 'Business', tokenCount: 50, price: 59.99 },
    ],
    skipDuplicates: true,
  });

  await Promise.all([
    prisma.tokenPackage.update({
      where: { title: 'Starter' },
      data: { tokenCount: 5, price: 9.99, currency: 'EUR', isActive: true },
    }),
    prisma.tokenPackage.update({
      where: { title: 'Professional' },
      data: { tokenCount: 20, price: 29.99, currency: 'EUR', isActive: true },
    }),
    prisma.tokenPackage.update({
      where: { title: 'Business' },
      data: { tokenCount: 50, price: 59.99, currency: 'EUR', isActive: true },
    }),
  ]);

  const tokenPackages = await prisma.tokenPackage.findMany({
    where: { title: { in: ['Starter', 'Professional', 'Business'] } },
  });
  const tokenPackageByTitle = new Map(tokenPackages.map((tokenPackage) => [tokenPackage.title, tokenPackage]));
  const storeProductMappings = [
    { title: 'Starter', platformProductId: 'maltapro_tokens_5' },
    { title: 'Professional', platformProductId: 'maltapro_tokens_20' },
    { title: 'Business', platformProductId: 'maltapro_tokens_50' },
  ];

  for (const mapping of storeProductMappings) {
    const tokenPackage = tokenPackageByTitle.get(mapping.title);

    if (!tokenPackage) {
      continue;
    }

    await prisma.storeProduct.upsert({
      where: {
        platform_platformProductId: {
          platform: 'REVENUECAT',
          platformProductId: mapping.platformProductId,
        },
      },
      create: {
        platform: 'REVENUECAT',
        platformProductId: mapping.platformProductId,
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
      update: {
        tokenPackageId: tokenPackage.id,
        isActive: true,
      },
    });
  }

  const employer = await upsertUser({
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

  const existingJob = await prisma.jobRequest.findFirst({
    where: {
      employerId: employer.id,
      title: 'Rewire two bedroom apartment',
    },
  });

  if (!existingJob) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.jobRequest.create({
      data: {
        employerId: employer.id,
        title: 'Rewire two bedroom apartment',
        description:
          'Need a licensed electrician to inspect and rewire an older two bedroom apartment before renovation work starts.',
        category: 'electrical',
        subcategory: 'wiring',
        location: 'Sliema, Malta',
        expiresAt,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a',
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  console.info('Seed data ready.');
  console.info(`Test password for all seed users: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

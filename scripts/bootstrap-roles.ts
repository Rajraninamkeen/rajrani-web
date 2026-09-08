// Session 29 dev-fixture bootstrap: non-seller role users used for live console/E2E demos.
// Mirrors how prior sessions provisioned these accounts ad hoc (they are not part of the
// catalog seed). Safe to re-run (upserts). Run with: DATABASE_URL=... npx ts-node scripts/bootstrap-roles.ts
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://bilokat:bilokat_dev@localhost:5432/bilokat',
  }),
});

const USERS = [
  { email: 'pfop@example.com', fullName: 'PF Op', password: 'Operator@123', role: 'OPERATOR', phone: '9900000022' },
  { email: 's12@example.com', fullName: 'Priya Sharma', password: 'Test@12345', role: 'CUSTOMER', phone: '9900000012' },
  { email: 'delivery15@example.com', fullName: 'Ravi Courier', password: 'Delivery@123', role: 'DELIVERY', phone: '9900000015' },
];

async function main() {
  const users = [];
  for (const u of USERS) {
    const passwordHash = await hash(u.password, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role as never, status: 'ACTIVE', phone: u.phone },
      create: {
        email: u.email, fullName: u.fullName, passwordHash,
        role: u.role as never, status: 'ACTIVE', phone: u.phone,
      },
    });
    users.push(user);
    console.log(`  ✓ ${u.email} (${u.role})`);
  }
  const dlv = users.find((u) => u.role === 'DELIVERY')!;
  const existing = await prisma.deliveryPartner.findUnique({ where: { userId: dlv.id } });
  if (!existing) {
    const partner = await prisma.deliveryPartner.create({
      data: {
        userId: dlv.id,
        partnerCode: 'DLV-DEMO15',
        status: 'ACTIVE',
        vehicleType: 'motorcycle',
      },
    });
    console.log(`  ✓ delivery partner ${partner.partnerCode} (ACTIVE)`);
  } else {
    console.log(`  ✓ delivery partner already bound (${existing.partnerCode})`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

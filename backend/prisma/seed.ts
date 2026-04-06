import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Deletes all app data, then creates a single ADMIN user (production-like empty slate). */
async function wipeAll() {
  await prisma.orderRiderChange.deleteMany({});
  await prisma.adminLog.deleteMany({});
  await prisma.riderEarning.deleteMany({});
  await prisma.storeEarning.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.pendingPayment.deleteMany({});
  await prisma.withdrawRequest.deleteMany({});
  await prisma.savedPaymentMethod.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.otp.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.productCategory.deleteMany({});
  await prisma.storeToCategory.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.riderProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function main() {
  console.log('🌱 Resetting database — admin only (VYBE Superapp)\n');

  await wipeAll();
  console.log('✓ All users, stores, orders, and related data removed\n');

  const adminHash = await bcrypt.hash('Admin123!', 10);

  await prisma.user.create({
    data: {
      email: 'admin@vybe.pk',
      name: 'Admin',
      phone: '3000000000',
      password: adminHash,
      role: 'ADMIN',
      isVerified: true,
      passwordSet: true,
    },
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE — only admin user exists');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Admin: admin@vybe.pk / Admin123!');
  console.log('  Add stores, riders, and customers from the admin panel or signup.');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

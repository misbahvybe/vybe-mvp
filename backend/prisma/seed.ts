import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=400&auto=format&fit=crop&q=60`;

/** Full reset then only: admin, store1@vybe.pk, one rider, customer1 (see DEPLOYMENT.md). */
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
  console.log('🌱 Seeding Vybe — minimal accounts only (DEPLOYMENT.md)\n');

  await wipeAll();
  console.log('✓ Database wiped\n');

  const adminHash = await bcrypt.hash('Admin123!', 10);
  const storeHash = await bcrypt.hash('Store123!', 10);
  const riderHash = await bcrypt.hash('Rider123!', 10);
  const customerHash = await bcrypt.hash('Customer123!', 10);

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

  const storeOwner = await prisma.user.create({
    data: {
      email: 'store1@vybe.pk',
      name: 'Demo Store Owner',
      phone: '3000001001',
      password: storeHash,
      role: 'STORE_OWNER',
      isVerified: true,
      passwordSet: true,
    },
  });

  const riderUser = await prisma.user.create({
    data: {
      email: '3200002001@rider.vybe.pk',
      name: 'Demo Rider',
      phone: '3200002001',
      password: riderHash,
      role: 'RIDER',
      isVerified: true,
      passwordSet: true,
    },
  });

  await prisma.riderProfile.create({
    data: {
      userId: riderUser.id,
      vehicleType: 'Bike',
      vehicleNumber: 'LHR-1000-1',
      isAvailable: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer1@test.pk',
      name: 'Demo Customer',
      phone: '3331234001',
      password: customerHash,
      role: 'CUSTOMER',
      isVerified: true,
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      fullAddress: 'House 1, Demo Street, DHA Phase 5, Lahore',
      city: 'Lahore',
      latitude: new Decimal('31.4704'),
      longitude: new Decimal('74.4089'),
      label: 'Home',
      isDefault: true,
    },
  });

  const foodCat = await prisma.storeCategory.upsert({
    where: { name: 'food' },
    update: {},
    create: { name: 'food' },
  });

  const store = await prisma.store.create({
    data: {
      ownerId: storeOwner.id,
      name: 'Vybe Demo Kitchen',
      description: 'Demo menu — add more items in store or admin panel',
      city: 'Lahore',
      address: 'DHA Phase 5, Lahore',
      phone: '03001234567',
      isApproved: true,
      isOpen: true,
      openingTime: '09:00',
      closingTime: '22:00',
      latitude: new Decimal('31.4704'),
      longitude: new Decimal('74.4089'),
    },
  });

  await prisma.storeToCategory.create({
    data: { storeId: store.id, categoryId: foodCat.id },
  });

  const catPopular = await prisma.productCategory.create({
    data: { storeId: store.id, name: 'Popular', sortOrder: 0 },
  });
  await prisma.productCategory.create({
    data: { storeId: store.id, name: 'All items', sortOrder: 1 },
  });

  const demoProducts = [
    { name: 'Chicken Biryani', price: 450, desc: 'Half plate', img: '1563379926899-bcef1a36750d' },
    { name: 'Beef Karahi', price: 650, desc: 'Half kg', img: '1544025162-fa87d493f0f0' },
    { name: 'Naan (2 pcs)', price: 80, desc: 'Tandoori', img: '1509440159596-0249088772ff' },
  ];

  for (const p of demoProducts) {
    await prisma.product.create({
      data: {
        storeId: store.id,
        productCategoryId: catPopular.id,
        name: p.name,
        description: p.desc,
        price: new Decimal(p.price),
        stock: new Decimal(100),
        imageUrl: unsplash(p.img),
        isAvailable: true,
        isOutOfStock: false,
      },
    });
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE — only DEPLOYMENT.md accounts + one demo store');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Admin:    admin@vybe.pk / Admin123!');
  console.log('  Store:    store1@vybe.pk / Store123!');
  console.log('  Rider:    3200002001@rider.vybe.pk / Rider123!');
  console.log('  Customer: customer1@test.pk / Customer123!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

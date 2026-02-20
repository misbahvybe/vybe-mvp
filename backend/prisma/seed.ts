import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const PLATFORM_COMMISSION_PERCENT = 0.15;
const DELIVERY_FEE = 150;
const SERVICE_FEE = 23.49;

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=400&auto=format&fit=crop&q=60`;

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60000);
}

async function main() {
  console.log('🌱 Seeding Vybe platform with full dummy data...\n');

  // ═══════════════════════════════════════════════════════════════════════
  // 1. CLEAN SLATE (order matters for FKs)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('Cleaning existing order data...');
  await prisma.storeEarning.deleteMany({});
  await prisma.riderEarning.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.riderProfile.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.productCategory.deleteMany({});
  await prisma.storeToCategory.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.user.deleteMany({ where: { role: { not: 'ADMIN' } } });
  // Keep admin - recreate if needed
  const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminExists) {
    const hashed = await bcrypt.hash('Admin123!', 10);
    await prisma.user.create({
      data: {
        email: 'admin@vybe.pk',
        name: 'Admin',
        phone: '3000000000',
        password: hashed,
        role: 'ADMIN',
        isVerified: true,
        passwordSet: true,
      },
    });
  }
  console.log('✓ Clean slate ready\n');

  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const pwd = await bcrypt.hash('Store123!', 10);

  // ═══════════════════════════════════════════════════════════════════════
  // 2. STORE CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════
  const categories = await Promise.all(
    ['food', 'grocery', 'medicine'].map((name) =>
      prisma.storeCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );
  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  // ═══════════════════════════════════════════════════════════════════════
  // 3. STORE OWNERS (each owns 2-4 stores)
  // ═══════════════════════════════════════════════════════════════════════
  const storeOwnerData = [
    { name: 'Ali Khan', email: 'store1@vybe.pk', phone: '3000001001' },
    { name: 'Sara Ahmed', email: 'store2@vybe.pk', phone: '3000001002' },
    { name: 'Hassan Raza', email: 'store3@vybe.pk', phone: '3000001003' },
    { name: 'Fatima Noor', email: 'store4@vybe.pk', phone: '3000001004' },
  ];
  const storeOwners: { id: string; name: string }[] = [];
  for (const o of storeOwnerData) {
    const u = await prisma.user.create({
      data: {
        name: o.name,
        email: o.email,
        phone: o.phone,
        password: pwd,
        role: 'STORE_OWNER',
        isVerified: true,
        passwordSet: true,
      },
    });
    storeOwners.push({ id: u.id, name: u.name });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. STORES (assigned to owners, mixed categories)
  // ═══════════════════════════════════════════════════════════════════════
  const storesData: { name: string; desc: string; cat: 'food' | 'grocery' | 'medicine'; ownerIdx: number; isOpen: boolean }[] = [
    { name: 'Daily Grocery', desc: 'Fresh fruits & essentials', cat: 'grocery', ownerIdx: 0, isOpen: true },
    { name: 'Fresh Mart', desc: 'Fresh produce & daily essentials', cat: 'grocery', ownerIdx: 0, isOpen: true },
    { name: 'Karachi Biryani House', desc: 'Authentic biryani & karahi', cat: 'food', ownerIdx: 1, isOpen: true },
    { name: 'Lahore Dhaba', desc: 'Traditional Pakistani cuisine', cat: 'food', ownerIdx: 1, isOpen: false },
    { name: 'Pizza Palace', desc: 'Pizza, burgers & wraps', cat: 'food', ownerIdx: 1, isOpen: true },
    { name: 'Green Valley Store', desc: 'Organic fruits and vegetables', cat: 'grocery', ownerIdx: 2, isOpen: true },
    { name: 'City Supermarket', desc: 'Everything under one roof', cat: 'grocery', ownerIdx: 2, isOpen: true },
    { name: 'HealthPlus Pharmacy', desc: 'Prescriptions & OTC medicine', cat: 'medicine', ownerIdx: 3, isOpen: true },
    { name: 'MedicCare', desc: 'Verified medicine delivery', cat: 'medicine', ownerIdx: 3, isOpen: true },
  ];
  const stores: { id: string; name: string; ownerId: string }[] = [];
  for (const s of storesData) {
    const store = await prisma.store.create({
      data: {
        ownerId: storeOwners[s.ownerIdx].id,
        name: s.name,
        description: s.desc,
        city: 'Lahore',
        address: `${s.name}, DHA Phase 5, Lahore`,
        phone: `03${String(s.ownerIdx + 1).padStart(2, '0')}${Math.floor(10000000 + Math.random() * 90000000)}`,
        isApproved: true,
        isOpen: s.isOpen,
        openingTime: '09:00',
        closingTime: '22:00',
        latitude: 31.4704 + (Math.random() - 0.5) * 0.05,
        longitude: 74.4089 + (Math.random() - 0.5) * 0.05,
      },
    });
    stores.push({ id: store.id, name: store.name, ownerId: store.ownerId });
    await prisma.storeToCategory.create({
      data: { storeId: store.id, categoryId: catMap[s.cat] },
    });
  }
  console.log(`✓ Created ${stores.length} stores\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 5. PRODUCT CATEGORIES & PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════
  const groceryItems = [
    { name: 'Apple', price: 250, desc: 'Fresh apples', img: '1619546813926-a78fa6372cd2' },
    { name: 'Banana', price: 120, desc: 'Ripe bananas', img: '1603833664858-49ae82afd80c' },
    { name: 'Milk 1L', price: 200, desc: 'Fresh milk', img: '1550583724-b2692b85b150' },
    { name: 'Bread', price: 150, desc: 'Fresh bread', img: '1509440159596-0249088772ff' },
    { name: 'Eggs', price: 280, desc: 'Farm fresh', img: '1582722872445-44dc5f7e3c8f' },
    { name: 'Rice 1kg', price: 350, desc: 'Basmati', img: '1586201375761-83865001e31c' },
  ];
  const foodItems = [
    { name: 'Chicken Biryani', price: 450, desc: 'Half kg', img: '1563379926899-bcef1a36750d' },
    { name: 'Beef Karahi', price: 650, desc: 'Half kg', img: '1544025162-fa87d493f0f0' },
    { name: 'Naan (2 pcs)', price: 80, desc: 'Tandoori naan', img: '1509440159596-0249088772ff' },
    { name: 'Daal', price: 200, desc: 'Lentil curry', img: '1547592168-3e0f6c1e7a0a' },
    { name: 'Chicken Burger', price: 350, desc: 'With fries', img: '1568902318171-92cc854aedfa' },
  ];
  const medicineItems = [
    { name: 'Paracetamol 500mg', price: 80, desc: 'Strip of 10', img: '1584308666744-24d5c474f2ae' },
    { name: 'Vitamin C', price: 350, desc: '60 tablets', img: '1550572017-8a40329f9f54' },
    { name: 'Antiseptic Cream', price: 120, desc: '30g', img: '1587856931848-268f40c42b63' },
  ];

  const getItems = (cat: string) => {
    if (cat === 'food') return foodItems;
    if (cat === 'medicine') return medicineItems;
    return groceryItems;
  };

  const productsByStore = new Map<string, { id: string; price: number }[]>();
  for (let idx = 0; idx < stores.length; idx++) {
    const store = stores[idx];
    const storeInfo = storesData[idx];
    const catName = storeInfo?.cat ?? 'grocery';
    const items = getItems(catName);
    const cats = await prisma.productCategory.createManyAndReturn({
      data: [
        { storeId: store.id, name: 'Popular', sortOrder: 0 },
        { storeId: store.id, name: 'All Items', sortOrder: 1 },
      ],
    });
    const prods: { id: string; price: number }[] = [];
    for (const p of items) {
      const prod = await prisma.product.create({
        data: {
          storeId: store.id,
          productCategoryId: cats[0]?.id ?? null,
          name: p.name,
          description: p.desc,
          price: p.price,
          stock: 100,
          imageUrl: unsplash(p.img),
        },
      });
      prods.push({ id: prod.id, price: p.price });
    }
    productsByStore.set(store.id, prods);
  }
  console.log(`✓ Created products for all stores\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 6. RIDERS
  // ═══════════════════════════════════════════════════════════════════════
  const riderData = [
    { name: 'Ahmed Ali', phone: '3200002001' },
    { name: 'Usman Malik', phone: '3200002002' },
    { name: 'Bilal Hussain', phone: '3200002003' },
    { name: 'Imran Shah', phone: '3200002004' },
    { name: 'Kamran Akhtar', phone: '3200002005' },
    { name: 'Zeeshan Ahmed', phone: '3200002006' },
    { name: 'Faisal Khan', phone: '3200002007' },
    { name: 'Rashid Mehmood', phone: '3200002008' },
  ];
  const riders: { id: string; name: string }[] = [];
  const riderPwd = await bcrypt.hash('Rider123!', 10);
  for (const r of riderData) {
    const u = await prisma.user.create({
      data: {
        name: r.name,
        phone: r.phone,
        email: `${r.phone}@rider.vybe.pk`,
        password: riderPwd,
        role: 'RIDER',
        isVerified: true,
        passwordSet: true,
      },
    });
    await prisma.riderProfile.create({
      data: {
        userId: u.id,
        vehicleType: Math.random() > 0.5 ? 'Bike' : 'Bike',
        vehicleNumber: `LHR-${1000 + riders.length}-${Math.floor(Math.random() * 10)}`,
        isAvailable: riders.length < 6,
      },
    });
    riders.push({ id: u.id, name: u.name });
  }
  console.log(`✓ Created ${riders.length} riders\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 7. CUSTOMERS & ADDRESSES
  // ═══════════════════════════════════════════════════════════════════════
  const customerData = [
    { name: 'Ayesha Malik', phone: '3331234001', email: 'customer1@test.pk' },
    { name: 'Omar Farooq', phone: '3331234002', email: 'customer2@test.pk' },
    { name: 'Sana Khan', phone: '3331234003', email: 'customer3@test.pk' },
    { name: 'Tariq Mahmood', phone: '3331234004', email: 'customer4@test.pk' },
    { name: 'Nadia Hussain', phone: '3331234005', email: 'customer5@test.pk' },
    { name: 'Farhan Ahmed', phone: '3331234006', email: 'customer6@test.pk' },
    { name: 'Zara Ali', phone: '3331234007', email: 'customer7@test.pk' },
    { name: 'Hammad Rashid', phone: '3331234008', email: 'customer8@test.pk' },
    { name: 'Maryam Siddiqui', phone: '3331234009', email: 'customer9@test.pk' },
    { name: 'Hamza Yousuf', phone: '3331234010', email: 'customer10@test.pk' },
    { name: 'Laiba Ahmed', phone: '3331234011', email: 'customer11@test.pk' },
    { name: 'Saad Iqbal', phone: '3331234012', email: 'customer12@test.pk' },
  ];
  const customerPwd = await bcrypt.hash('Customer123!', 10);
  const customersWithAddresses: { id: string; addressIds: string[] }[] = [];
  for (const c of customerData) {
    const u = await prisma.user.create({
      data: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        password: customerPwd,
        role: 'CUSTOMER',
        isVerified: true,
      },
    });
    const addrs: string[] = [];
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
      const a = await prisma.address.create({
        data: {
          userId: u.id,
          fullAddress: `House ${100 + i}, Street ${5 + i}, DHA Phase ${4 + (i % 3)}, Lahore`,
          city: 'Lahore',
          latitude: 31.47 + Math.random() * 0.05,
          longitude: 74.4 + Math.random() * 0.05,
          label: i === 0 ? 'Home' : 'Office',
          isDefault: i === 0,
        },
      });
      addrs.push(a.id);
    }
    customersWithAddresses.push({ id: u.id, addressIds: addrs });
  }
  console.log(`✓ Created ${customersWithAddresses.length} customers with addresses\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 8. ORDERS (spread over 30 days, mixed statuses)
  // ═══════════════════════════════════════════════════════════════════════
  const now = new Date();
  const statuses: Array<'PENDING' | 'STORE_ACCEPTED' | 'READY_FOR_PICKUP' | 'RIDER_ASSIGNED' | 'RIDER_ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED'> = [
    'PENDING', 'STORE_ACCEPTED', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED',
  ];
  const statusWeights = [3, 2, 4, 2, 2, 2, 60, 8]; // More delivered, some pending/stuck
  const pickStatus = () => {
    const r = Math.random() * 100;
    let acc = 0;
    for (let i = 0; i < statusWeights.length; i++) {
      acc += statusWeights[i];
      if (r < acc) return statuses[i];
    }
    return statuses[statuses.length - 1];
  };

  let orderCount = 0;
  for (let dayOffset = -14; dayOffset <= 0; dayOffset++) {
    const baseDate = addDays(now, dayOffset);
    const ordersToday = dayOffset === 0 ? 8 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < ordersToday; i++) {
      const customer = customersWithAddresses[Math.floor(Math.random() * customersWithAddresses.length)];
      const store = stores[Math.floor(Math.random() * stores.length)];
      const products = productsByStore.get(store.id) ?? [];
      if (products.length === 0) continue;
      const numItems = 1 + Math.floor(Math.random() * Math.min(3, products.length));
      const chosenProducts: { id: string; price: number }[] = [];
      const used = new Set<string>();
      while (chosenProducts.length < numItems) {
        const p = products[Math.floor(Math.random() * products.length)];
        if (!used.has(p.id)) {
          used.add(p.id);
          chosenProducts.push(p);
        }
      }
      const subtotal = chosenProducts.reduce((s, p) => s + p.price * (1 + Math.floor(Math.random() * 2)), 0);
      const commission = subtotal * PLATFORM_COMMISSION_PERCENT;
      const storeAmount = subtotal - commission;
      const total = subtotal + DELIVERY_FEE + SERVICE_FEE;
      const createdAt = addMinutes(baseDate, i * 47 + Math.floor(Math.random() * 60));
      const orderStatus = pickStatus();
      const needsRider = ['RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP', 'DELIVERED'].includes(orderStatus);
      const rider = needsRider ? riders[Math.floor(Math.random() * riders.length)] : null;

      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          storeId: store.id,
          addressId: customer.addressIds[0],
          riderId: rider?.id ?? null,
          subtotalAmount: new Decimal(subtotal),
          deliveryFee: new Decimal(DELIVERY_FEE),
          serviceFee: new Decimal(SERVICE_FEE),
          totalAmount: new Decimal(total),
          commissionAmount: new Decimal(commission),
          paymentMethod: Math.random() > 0.3 ? 'COD' : 'CARD',
          paymentStatus: Math.random() > 0.3 ? 'PENDING' : 'PAID',
          orderStatus,
          createdAt,
          updatedAt: createdAt,
        },
      });
      for (const p of chosenProducts) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: p.id,
            quantity: 1 + Math.floor(Math.random() * 2),
            price: p.price,
          },
        });
      }

      await prisma.storeEarning.create({
        data: {
          storeId: store.id,
          orderId: order.id,
          storeAmount: new Decimal(storeAmount),
          commissionAmount: new Decimal(commission),
          createdAt,
        },
      });

      const historyStatuses: typeof orderStatus[] = ['PENDING'];
      if (['STORE_ACCEPTED', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP', 'DELIVERED'].includes(orderStatus)) {
        historyStatuses.push('STORE_ACCEPTED');
      }
      if (['READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP', 'DELIVERED'].includes(orderStatus)) {
        historyStatuses.push('READY_FOR_PICKUP');
      }
      if (['RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP', 'DELIVERED'].includes(orderStatus)) {
        historyStatuses.push('RIDER_ASSIGNED');
        historyStatuses.push('RIDER_ACCEPTED');
      }
      if (['PICKED_UP', 'DELIVERED'].includes(orderStatus)) {
        historyStatuses.push('PICKED_UP');
      }
      if (orderStatus === 'DELIVERED') {
        historyStatuses.push('DELIVERED');
      }
      if (orderStatus === 'CANCELLED') {
        historyStatuses.push('CANCELLED');
      }
      for (let h = 0; h < historyStatuses.length; h++) {
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: historyStatuses[h],
            changedByUserId: h === 0 ? customer.id : h < 3 ? store.ownerId : rider?.id ?? admin.id,
            createdAt: addMinutes(createdAt, h * 5 + Math.floor(Math.random() * 3)),
          },
        });
      }

      if (orderStatus === 'DELIVERED' && rider) {
        await prisma.riderEarning.create({
          data: {
            riderId: rider.id,
            orderId: order.id,
            earningAmount: new Decimal(DELIVERY_FEE),
            createdAt,
          },
        });
      }
      orderCount++;
    }
  }
  console.log(`✓ Created ${orderCount} orders with earnings & history\n`);

  // Add a few "stuck" orders for admin alerts (PENDING > 10 min, READY > 15 min)
  const stuckPendingCustomer = customersWithAddresses[0];
  const stuckStore = stores[0];
  const stuckProds = productsByStore.get(stuckStore.id) ?? [];
  if (stuckProds.length > 0) {
    const subtotal = stuckProds[0].price * 2;
    const commission = subtotal * PLATFORM_COMMISSION_PERCENT;
    const total = subtotal + DELIVERY_FEE + SERVICE_FEE;
    const oldTime = addMinutes(now, -25);
    const stuckOrder1 = await prisma.order.create({
      data: {
        customerId: stuckPendingCustomer.id,
        storeId: stuckStore.id,
        addressId: stuckPendingCustomer.addressIds[0],
        subtotalAmount: new Decimal(subtotal),
        deliveryFee: new Decimal(DELIVERY_FEE),
        serviceFee: new Decimal(SERVICE_FEE),
        totalAmount: new Decimal(total),
        commissionAmount: new Decimal(commission),
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        createdAt: oldTime,
        updatedAt: oldTime,
      },
    });
    await prisma.orderItem.create({
      data: { orderId: stuckOrder1.id, productId: stuckProds[0].id, quantity: 2, price: stuckProds[0].price },
    });
    await prisma.storeEarning.create({
      data: {
        storeId: stuckStore.id,
        orderId: stuckOrder1.id,
        storeAmount: new Decimal(subtotal - commission),
        commissionAmount: new Decimal(commission),
        createdAt: oldTime,
      },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: stuckOrder1.id, status: 'PENDING', changedByUserId: stuckPendingCustomer.id, createdAt: oldTime },
    });

    const stuckOrder2 = await prisma.order.create({
      data: {
        customerId: stuckPendingCustomer.id,
        storeId: stuckStore.id,
        addressId: stuckPendingCustomer.addressIds[0],
        subtotalAmount: new Decimal(subtotal),
        deliveryFee: new Decimal(DELIVERY_FEE),
        serviceFee: new Decimal(SERVICE_FEE),
        totalAmount: new Decimal(total),
        commissionAmount: new Decimal(commission),
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'READY_FOR_PICKUP',
        createdAt: addMinutes(now, -20),
        updatedAt: addMinutes(now, -20),
      },
    });
    await prisma.orderItem.create({
      data: { orderId: stuckOrder2.id, productId: stuckProds[0].id, quantity: 2, price: stuckProds[0].price },
    });
    await prisma.storeEarning.create({
      data: {
        storeId: stuckStore.id,
        orderId: stuckOrder2.id,
        storeAmount: new Decimal(subtotal - commission),
        commissionAmount: new Decimal(commission),
      },
    });
    const stuck2Time = addMinutes(now, -20);
    await prisma.orderStatusHistory.create({
      data: { orderId: stuckOrder2.id, status: 'PENDING', changedByUserId: stuckPendingCustomer.id, createdAt: addMinutes(stuck2Time, -15) },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: stuckOrder2.id, status: 'STORE_ACCEPTED', changedByUserId: stuckStore.ownerId, createdAt: addMinutes(stuck2Time, -10) },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: stuckOrder2.id, status: 'READY_FOR_PICKUP', changedByUserId: stuckStore.ownerId, createdAt: stuck2Time },
    });
    console.log('✓ Added stuck orders for admin alerts\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE – Platform ready with full dummy data');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Login credentials:');
  console.log('  Admin:     admin@vybe.pk / Admin123!');
  console.log('  Store:     store1@vybe.pk / Store123!  (or store2-4)');
  console.log('  Rider:     3200002001@rider.vybe.pk / Rider123!');
  console.log('  Customer:  customer1@test.pk / Customer123!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

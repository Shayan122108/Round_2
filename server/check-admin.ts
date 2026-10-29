
import { PrismaClient } from '@prisma/client';
import { hashPin, verifyPin } from './src/auth/auth.js';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { registrationId: 'ADMIN' },
    select: {
      registrationId: true,
      role: true,
      pinHash: true,
    },
  });

  console.log('Admin exists:', Boolean(admin));
  console.log('Admin role:', admin?.role ?? 'NOT FOUND');
  console.log(
    'Hash format valid:',
    Boolean(admin?.pinHash?.startsWith('scrypt$16384$8$1$')),
  );

  if (admin) {
    const matches = await verifyPin(
      process.env.ADMIN_PIN ?? '',
      admin.pinHash,
    );
    console.log('PIN matches stored hash:', matches);
  }
}

main()
  .catch((error) => {
    console.error('Diagnostic failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

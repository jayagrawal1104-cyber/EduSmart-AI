/**
 * Seed script — creates one demo institution with an admin, a department,
 * a course, one faculty member and one student so you can log in and click
 * through the app immediately after migrating.
 *
 * Run with: npm run db:seed
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const institution = await prisma.institution.create({
    data: {
      name: 'Tech University',
      code: 'EDU-DEMO-0001',
      status: 'ACTIVE',
      admins: {
        create: { name: 'Admin Rajesh', email: 'admin@techuniv.edu', passwordHash },
      },
      departments: {
        create: [{ name: 'Computer Science', code: 'CSE' }],
      },
    },
    include: { departments: true },
  });

  const department = institution.departments[0];

  const course = await prisma.course.create({
    data: {
      institutionId: institution.id,
      departmentId: department.id,
      name: 'B.Tech CSE',
      code: 'BTCSE',
    },
  });

  const faculty = await prisma.faculty.create({
    data: {
      institutionId: institution.id,
      departmentId: department.id,
      name: 'Dr. Suresh Kumar',
      email: 'suresh.kumar@techuniv.edu',
      passwordHash,
      designation: 'Professor',
    },
  });

  await prisma.student.create({
    data: {
      institutionId: institution.id,
      departmentId: department.id,
      courseId: course.id,
      name: 'Aarav Sharma',
      email: 'aarav.sharma@techuniv.edu',
      passwordHash,
      year: 3,
      section: 'A',
      rollId: 'CSE2023001',
    },
  });

  console.log('Seeded! Institute code: EDU-DEMO-0001, password for all accounts: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
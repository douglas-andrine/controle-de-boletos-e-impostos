import { PrismaClient } from "@prisma/client";
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoUser } from "../src/lib/demo";

const prisma = new PrismaClient();

seedDemoUser(prisma)
  .then(() => console.log(`Seed concluído: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

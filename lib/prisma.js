const { PrismaClient } = require("@prisma/client");

// Singleton pattern para Prisma Client
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

// Desconectar apenas quando o processo terminar
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;

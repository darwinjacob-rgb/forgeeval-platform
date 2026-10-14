import app from "./app.ts";
import config from "./config/index.ts";
import prisma from "./config/database.ts";

async function main() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log(" Connected to PostgreSQL database successfully via Prisma");

    const server = app.listen(config.port, "0.0.0.0", () => {
      console.log(` ForgeEval Backend Server running on port ${config.port} (${config.nodeEnv})`);
      console.log(` Health check: http://localhost:${config.port}/health`);
      console.log(` API Base URL: http://localhost:${config.port}/api/v1`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log(" Database disconnected. Exiting process.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error(" Failed to start backend server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();

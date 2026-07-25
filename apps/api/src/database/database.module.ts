import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * DatabaseModule provides Prisma database access throughout the application.
 * It is marked as Global, so it only needs to be imported once in the root AppModule.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

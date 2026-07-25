# Database Module

This module provides Prisma database access throughout the application using the repository pattern.

## Overview

The DatabaseModule exposes a `PrismaService` that extends `PrismaClient` and implements proper lifecycle management:

- **OnModuleInit**: Connects to the database when the module initializes
- **OnModuleDestroy**: Disconnects from the database when the module is destroyed

## Usage

The DatabaseModule is marked as `@Global()`, so it only needs to be imported once in the root `AppModule`.

### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: { email: string; name?: string }) {
    return this.prisma.user.create({ data });
  }
}
```

## Features

- **Automatic Connection Management**: Connects on module init, disconnects on destroy
- **Error Handling**: Proper error logging for connection failures
- **Graceful Shutdown**: Supports NestJS graceful shutdown via `app.enableShutdownHooks()`
- **Logging**: Configured to log errors and warnings
- **Global Module**: Available throughout the application without repeated imports

## Configuration

The database connection is configured via the `DATABASE_URL` environment variable:

```
DATABASE_URL="postgresql://user:password@localhost:5432/database?schema=public"
```

## Testing

The module includes comprehensive unit tests for:

- Service initialization
- Connection lifecycle (onModuleInit, onModuleDestroy)
- Error handling for connection failures
- Module dependency injection

Run tests with:

```bash
npm test -- src/database
```

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'ProfitTerminal Backend API - Running on localhost:4000';
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AiService } from './ai.service';
import { OpenAIProvider } from './providers/openai.provider';
import { PromptBuilderService } from './prompt-builder.service';
import { AuditModule } from '../audit/audit.module';

/**
 * AI Module
 *
 * CRITICAL: This module does NOT import MarketDataModule or any Broker providers.
 * AI Service only receives processed quant results, never raw market data.
 * This architectural constraint prevents AI from fabricating data or bypassing risk controls.
 *
 * Supports multiple AI providers:
 * - OpenAI (external API)
 * - Ollama (local LLM)
 *
 * Provider selection is configured via AI_PROVIDER environment variable.
 */
@Module({
  imports: [ConfigModule, AuditModule],
  providers: [AiService, OpenAIProvider, PromptBuilderService],
  exports: [AiService, PromptBuilderService],
})
export class AiModule {}

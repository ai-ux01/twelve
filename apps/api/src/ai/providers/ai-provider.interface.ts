import { ParsedPrompt } from '../../prompt/prompt.service';
import { QuantAnalysisResult } from '../../quant/quant.service';
import { Recommendation } from '../ai.service';
import { PortfolioResponse } from '../../portfolio/portfolio.service';

/**
 * AI Provider Interface
 *
 * Defines the contract that all AI providers (OpenAI, Ollama) must implement.
 * This abstraction allows the system to support multiple AI backends without
 * changing the core AiService logic.
 */
export interface AiProvider {
  /**
   * Generate a trade recommendation based on quantitative analysis
   *
   * @param parsedPrompt - User's parsed intent
   * @param quantAnalysis - Processed quantitative results (NOT raw market data)
   * @param portfolioState - Optional current portfolio state
   * @returns Partial recommendation data (without id and quantData)
   */
  generateRecommendation(
    parsedPrompt: ParsedPrompt,
    quantAnalysis: QuantAnalysisResult,
    portfolioState?: PortfolioResponse
  ): Promise<Omit<Recommendation, 'id' | 'quantData'>>;

  /**
   * Analyze portfolio health based on current positions
   *
   * @param portfolioState - Current portfolio state
   * @param quantAnalysis - Array of quant analysis for all positions
   * @returns Portfolio analysis with health score and recommendations
   */
  analyzePortfolio(
    portfolioState: PortfolioResponse,
    quantAnalysis: QuantAnalysisResult[]
  ): Promise<any>;
}

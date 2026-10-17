// checkin-daily/frontend/server/utils/article-validator.ts
// Re-export shared validator functions for server-side Nitro routes
export {
  ARTICLE_RULES,
  extractBodyPlainText,
  calculateBodyTextLength,
  extractBodyImages,
  validateArticleForPublish,
  type ExtractedImage,
  type ArticleValidationResult,
} from '../../utils/article-validator'

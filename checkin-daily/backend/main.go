package main

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type Article struct {
	ID          uint       `json:"id" gorm:"primaryKey"`
	Title       string     `json:"title" gorm:"size:180;not null"`
	Slug        string     `json:"slug" gorm:"uniqueIndex;size:200;not null"`
	Summary     string     `json:"summary" gorm:"size:500"`
	Content     string     `json:"content" gorm:"type:text"`
	Category    string     `json:"category" gorm:"size:60;index;not null"`
	Author      string     `json:"author" gorm:"size:80"`
	CoverImage  string     `json:"coverImage"`
	Status      string     `json:"status" gorm:"size:20;index;not null;default:draft"`
	PublishedAt *time.Time `json:"publishedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type Category struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:60;not null"`
	Slug      string    `json:"slug" gorm:"uniqueIndex;size:60;not null"`
	CreatedAt time.Time `json:"createdAt"`
}

type ArticleInput struct {
	Title      string `json:"title" binding:"required"`
	Slug       string `json:"slug" binding:"required"`
	Summary    string `json:"summary"`
	Content    string `json:"content"`
	Category   string `json:"category" binding:"required"`
	Author     string `json:"author"`
	CoverImage string `json:"coverImage"`
	Status     string `json:"status" binding:"required,oneof=draft published"`
}

type CategoryInput struct {
	Name string `json:"name" binding:"required,max=60"`
	Slug string `json:"slug" binding:"required,max=60"`
}

var db *gorm.DB

func main() {
	databasePath := os.Getenv("SQLITE_PATH")
	if databasePath == "" {
		databasePath = "checkin-daily.db"
	}
	var err error
	db, err = gorm.Open(sqlite.Open(databasePath), &gorm.Config{})
	if err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&Article{}, &Category{}); err != nil {
		panic(err)
	}
	seedArticles()

	router := gin.Default()
	router.Use(cors())
	router.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	router.GET("/api/categories", listCategories)
	router.GET("/api/admin/categories", listCategories)
	router.POST("/api/admin/categories", createCategory)
	router.PUT("/api/admin/categories/:id", updateCategory)
	router.DELETE("/api/admin/categories/:id", deleteCategory)
	router.GET("/api/articles", listArticles(false))
	router.GET("/api/articles/:slug", getArticle(false))
	router.GET("/api/admin/articles", listArticles(true))
	router.POST("/api/admin/articles", createArticle)
	router.PUT("/api/admin/articles/:id", updateArticle)
	router.DELETE("/api/admin/articles/:id", deleteArticle)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if err := router.Run(":" + port); err != nil {
		panic(err)
	}
}

func cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func listArticles(includeDrafts bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := db.Model(&Article{}).Order("published_at desc, created_at desc")
		if !includeDrafts {
			query = query.Where("status = ?", "published")
		}
		if category := c.Query("category"); category != "" {
			query = query.Where("category = ?", category)
		}
		var articles []Article
		if err := query.Find(&articles).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "articles could not be loaded"})
			return
		}
		c.JSON(http.StatusOK, articles)
	}
}

func getArticle(includeDrafts bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := db.Where("slug = ?", c.Param("slug"))
		if !includeDrafts {
			query = query.Where("status = ?", "published")
		}
		var article Article
		if err := query.First(&article).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
			return
		}
		c.JSON(http.StatusOK, article)
	}
}

func createArticle(c *gin.Context) {
	var input ArticleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !categoryExists(input.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown article category"})
		return
	}
	article := articleFromInput(input)
	if article.Slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "article slug must contain letters or numbers"})
		return
	}
	if err := db.Create(&article).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "article could not be created; check that the slug is unique"})
		return
	}
	c.JSON(http.StatusCreated, article)
}

func updateArticle(c *gin.Context) {
	var article Article
	if err := db.First(&article, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
	var input ArticleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !categoryExists(input.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown article category"})
		return
	}
	updated := articleFromInput(input)
	if updated.Slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "article slug must contain letters or numbers"})
		return
	}
	updated.ID = article.ID
	updated.CreatedAt = article.CreatedAt
	if err := db.Model(&article).Select("Title", "Slug", "Summary", "Content", "Category", "Author", "CoverImage", "Status", "PublishedAt").Updates(updated).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "article could not be updated; check that the slug is unique"})
		return
	}
	db.First(&article, article.ID)
	c.JSON(http.StatusOK, article)
}

func deleteArticle(c *gin.Context) {
	result := db.Delete(&Article{}, c.Param("id"))
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "article could not be deleted"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func listCategories(c *gin.Context) {
	var categories []Category
	if err := db.Order("id asc").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "categories could not be loaded"})
		return
	}
	c.JSON(http.StatusOK, categories)
}

func createCategory(c *gin.Context) {
	var input CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	category := Category{Name: input.Name, Slug: normalizeSlug(input.Slug)}
	if category.Slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category slug must contain letters or numbers"})
		return
	}
	if err := db.Create(&category).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "category could not be created; check that the slug is unique"})
		return
	}
	c.JSON(http.StatusCreated, category)
}

func updateCategory(c *gin.Context) {
	var category Category
	if err := db.First(&category, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	var input CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	oldSlug := category.Slug
	category.Name = input.Name
	category.Slug = normalizeSlug(input.Slug)
	if category.Slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category slug must contain letters or numbers"})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&category).Error; err != nil {
			return err
		}
		return tx.Model(&Article{}).Where("category = ?", oldSlug).Update("category", category.Slug).Error
	}); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "category could not be updated; check that the slug is unique"})
		return
	}
	c.JSON(http.StatusOK, category)
}

func deleteCategory(c *gin.Context) {
	var category Category
	if err := db.First(&category, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	var articleCount int64
	db.Model(&Article{}).Where("category = ?", category.Slug).Count(&articleCount)
	if articleCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "category is used by existing articles"})
		return
	}
	if err := db.Delete(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "category could not be deleted"})
		return
	}
	c.Status(http.StatusNoContent)
}

func categoryExists(slug string) bool {
	var count int64
	db.Model(&Category{}).Where("slug = ?", slug).Count(&count)
	return count > 0
}

func normalizeSlug(slug string) string {
	return strings.Trim(strings.ToLower(strings.ReplaceAll(slug, " ", "-")), "-")
}

func articleFromInput(input ArticleInput) Article {
	input.Slug = normalizeSlug(input.Slug)
	article := Article{
		Title: input.Title, Slug: input.Slug, Summary: input.Summary, Content: input.Content,
		Category: input.Category, Author: input.Author, CoverImage: input.CoverImage, Status: input.Status,
	}
	if input.Status == "published" {
		publishedAt := time.Now().UTC()
		article.PublishedAt = &publishedAt
	}
	return article
}

func seedArticles() {
	categories := []Category{{Name: "항공", Slug: "flights"}, {Name: "호텔", Slug: "hotels"}, {Name: "업계", Slug: "industry"}}
	for _, category := range categories {
		db.FirstOrCreate(&category, Category{Slug: category.Slug})
	}
	var count int64
	db.Model(&Article{}).Count(&count)
	if count > 0 {
		return
	}
	now := time.Now().UTC()
	articles := []Article{
		{Title: "마일리지 발권, 유류할증료까지 계산해야 하는 이유", Slug: "mileage-ticket-fees", Summary: "마일리지 좌석만 보던 시대는 끝났습니다. 발권 전 체크할 비용과 조건을 정리했습니다.", Content: "## 발권 전에 총액을 보세요\n\n마일리지 차감액뿐 아니라 유류할증료와 공항세를 함께 비교해야 합니다.\n\n- 출발일별 부과액 확인\n- 변경 및 취소 수수료 확인\n- 편도 여정도 별도 검색", Category: "flights", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
		{Title: "호텔 티어 혜택, 체크인 전에 확인할 세 가지", Slug: "hotel-status-checkin-benefits", Summary: "객실 업그레이드부터 레이트 체크아웃까지, 예약 채널과 투숙 조건이 혜택을 바꿉니다.", Content: "## 예약 조건이 혜택을 좌우합니다\n\n공식 채널 예약 여부와 체크인 시점의 객실 상황을 함께 살펴보세요.\n\n1. 회원 번호가 예약에 연결됐는지 확인합니다.\n2. 조식 및 라운지 동반 규정을 확인합니다.\n3. 레이트 체크아웃 시간을 프런트에 재확인합니다.", Category: "hotels", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
		{Title: "여행 업계 브리핑: 이번 주의 변화", Slug: "travel-industry-briefing", Summary: "항공과 호텔 업계의 주요 정책 변화를 한눈에 확인하세요.", Content: "## 이번 주 핵심\n\n새로운 운임 조건과 호텔 멤버십 정책은 예약 전에 공식 안내를 확인하는 것이 좋습니다.", Category: "industry", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
	}
	db.Create(&articles)
}
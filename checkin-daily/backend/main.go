package main

import (
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type Article struct {
	ID               uint       `json:"id" gorm:"primaryKey"`
	Title            string     `json:"title" gorm:"size:180;not null"`
	Slug             string     `json:"slug" gorm:"uniqueIndex;size:200;not null"`
	Summary          string     `json:"summary" gorm:"size:500"`
	Content          string     `json:"content" gorm:"type:text"`
	Category         string     `json:"category" gorm:"size:60;index;not null"`
	Author           string     `json:"author" gorm:"size:80"`
	CoverImage       string     `json:"coverImage"`
	Status           string     `json:"status" gorm:"size:20;index;not null;default:draft"`
	ViewCount        int64      `json:"viewCount" gorm:"not null;default:0"`
	PublishedAt      *time.Time `json:"publishedAt"`
	FirstPublishedAt *time.Time `json:"firstPublishedAt"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	Cities           []City     `json:"cities,omitempty" gorm:"many2many:article_cities;"`
}

type Category struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:60;not null"`
	Slug      string    `json:"slug" gorm:"uniqueIndex;size:60;not null"`
	CreatedAt time.Time `json:"createdAt"`
}

type Country struct {
	Code      string    `json:"code" gorm:"primaryKey;size:2"`
	NameKo    string    `json:"nameKo" gorm:"size:100;not null"`
	NameEn    string    `json:"nameEn" gorm:"size:100;not null"`
	Continent string    `json:"continent" gorm:"size:50"`
	SortOrder int       `json:"sortOrder" gorm:"not null;default:0"`
	CreatedAt time.Time `json:"createdAt"`
}

type City struct {
	ID          string    `json:"id" gorm:"primaryKey;size:50"`
	CountryCode string    `json:"countryCode" gorm:"size:2;not null;index"`
	NameKo      string    `json:"nameKo" gorm:"size:100;not null"`
	NameEn      string    `json:"nameEn" gorm:"size:100;not null"`
	Country     Country   `json:"country,omitempty" gorm:"foreignKey:CountryCode;references:Code"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AdPlacement struct {
	ID         string    `json:"id" gorm:"primaryKey;size:50"`
	Name       string    `json:"name" gorm:"size:100;not null"`
	AdClientID string    `json:"adClientId" gorm:"size:100"`
	AdSlotID   string    `json:"adSlotId" gorm:"size:100"`
	Format     string    `json:"format" gorm:"size:50;not null;default:auto"`
	IsActive   bool      `json:"isActive" gorm:"not null;default:false"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type AdminAccount struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Username     string    `json:"username" gorm:"uniqueIndex;size:254;not null"`
	PasswordHash string    `json:"-" gorm:"size:100;not null"`
	Role         string    `json:"role" gorm:"size:20;not null;default:admin"`
	IsActive     bool      `json:"isActive" gorm:"not null;default:true"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type SiteSetting struct {
	Key       string `json:"key" gorm:"primaryKey;size:100"`
	Value     string `json:"value" gorm:"type:text"`
	UpdatedAt string `json:"updated_at" gorm:"size:40"`
}

type ArticleInput struct {
	Title      string   `json:"title" binding:"required"`
	Slug       string   `json:"slug" binding:"required"`
	Summary    string   `json:"summary"`
	Content    string   `json:"content"`
	Category   string   `json:"category" binding:"required"`
	Author     string   `json:"author"`
	CoverImage string   `json:"coverImage"`
	Status     string   `json:"status" binding:"required,oneof=draft published"`
	CityIDs    []string `json:"cityIds"`
}

type CategoryInput struct {
	Name string `json:"name" binding:"required,max=60"`
	Slug string `json:"slug" binding:"required,max=60"`
}

type CountryInput struct {
	Code      string `json:"code" binding:"required,len=2"`
	NameKo    string `json:"nameKo" binding:"required,max=100"`
	NameEn    string `json:"nameEn" binding:"required,max=100"`
	Continent string `json:"continent" binding:"max=50"`
	SortOrder int    `json:"sortOrder"`
}

type CityInput struct {
	ID     string `json:"id" binding:"required,max=50"`
	NameKo string `json:"nameKo" binding:"required,max=100"`
	NameEn string `json:"nameEn" binding:"required,max=100"`
}

type AdPlacementInput struct {
	ID         string `json:"id" binding:"required,max=50"`
	Name       string `json:"name" binding:"required,max=100"`
	AdClientID string `json:"adClientId" binding:"max=100"`
	AdSlotID   string `json:"adSlotId" binding:"max=100"`
	Format     string `json:"format" binding:"max=50"`
	IsActive   bool   `json:"isActive"`
}

var db *gorm.DB

func main() {
	authConfig, err := loadAuthConfig()
	if err != nil {
		log.Fatal(err)
	}
	databasePath := os.Getenv("SQLITE_PATH")
	if databasePath == "" {
		databasePath = "checkin-daily.db"
	}
	db, err = gorm.Open(sqlite.Open(databasePath), &gorm.Config{})
	if err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&Article{}, &Category{}, &Country{}, &City{}, &AdPlacement{}, &AdminAccount{}, &SiteSetting{}); err != nil {
		panic(err)
	}
	if err := bootstrapAdminAccount(authConfig); err != nil {
		log.Fatal(err)
	}
	if err := migrateCategorySlugs(); err != nil {
		panic(err)
	}
	if err := seedLocations(); err != nil {
		panic(err)
	}
	if err := seedArticles(); err != nil {
		panic(err)
	}
	if err := seedAdPlacements(); err != nil {
		panic(err)
	}

	router := newRouter(newAdminAuth(authConfig))
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func newRouter(auth *adminAuth) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), securityHeaders(), cors(auth.config.allowedOrigins), limitRequestBody())
	router.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	router.POST("/api/auth/login", auth.login)
	router.GET("/api/auth/session", auth.requireAdmin, auth.session)
	router.POST("/api/auth/logout", auth.requireAdmin, auth.requireSameOrigin, auth.logout)
	router.GET("/api/categories", listCategories)
	router.GET("/api/countries", listCountries)
	router.GET("/api/countries/:code/cities", listCities)
	router.GET("/api/ads", listAdPlacements(false))
	router.GET("/api/articles", listArticles(false))
	router.GET("/api/articles/id/:id", getArticleByID)
	router.GET("/api/articles/:slug", getArticle(false))
	router.GET("/api/settings", getSiteSettings)

	admin := router.Group("/api/admin", auth.requireAdmin)
	admin.GET("/categories", listCategories)
	admin.GET("/countries", listCountries)
	admin.GET("/countries/:code/cities", listCities)
	admin.GET("/ads", listAdPlacements(true))
	admin.GET("/articles", listArticles(true))
	admin.GET("/articles/:id", getAdminArticle)
	admin.GET("/settings", getSiteSettings)

	adminWrite := router.Group("/api/admin", auth.requireAdmin, auth.requireSameOrigin)
	adminWrite.POST("/categories", createCategory)
	adminWrite.PUT("/categories/:id", updateCategory)
	adminWrite.DELETE("/categories/:id", deleteCategory)
	adminWrite.POST("/countries", createCountry)
	adminWrite.PUT("/countries/:code", updateCountry)
	adminWrite.DELETE("/countries/:code", deleteCountry)
	adminWrite.POST("/countries/:code/cities", createCity)
	adminWrite.PUT("/cities/:id", updateCity)
	adminWrite.DELETE("/cities/:id", deleteCity)
	adminWrite.POST("/ads", createAdPlacement)
	adminWrite.PUT("/ads/:id", updateAdPlacement)
	adminWrite.DELETE("/ads/:id", deleteAdPlacement)
	adminWrite.POST("/articles", createArticle)
	adminWrite.PUT("/articles/:id", updateArticle)
	adminWrite.DELETE("/articles/:id", deleteArticle)
	adminWrite.PUT("/settings", updateSiteSettings)
	adminWrite.POST("/settings", updateSiteSettings)

	registerEnterpriseRoutes(router, adminWrite)
	return router
}

func cors(allowedOrigins map[string]struct{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := strings.TrimRight(strings.TrimSpace(c.GetHeader("Origin")), "/")
		if origin != "" {
			if _, ok := allowedOrigins[origin]; !ok {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions {
			if origin == "" {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Header("Access-Control-Allow-Headers", "Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Max-Age", "600")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func limitRequestBody() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
		c.Next()
	}
}

func listArticles(includeDrafts bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := db.Model(&Article{}).Preload("Cities.Country")
		if !includeDrafts && c.Query("sort") == "views" {
			query = query.Order("view_count desc, published_at desc, created_at desc")
		} else {
			query = query.Order("published_at desc, created_at desc")
		}
		if !includeDrafts {
			query = query.Where("status = ?", "published")
		}
		if category := normalizeSlug(c.Query("category")); category != "" {
			query = query.Where("category = ?", canonicalCategory(category))
		}
		if search := strings.TrimSpace(c.Query("q")); search != "" {
			pattern := "%" + search + "%"
			query = query.Where("(title LIKE ? OR summary LIKE ?)", pattern, pattern)
		}
		countryCode := strings.ToUpper(strings.TrimSpace(c.Query("country")))
		if cityID := strings.TrimSpace(c.Query("city")); cityID != "" {
			articleIDs := db.Table("article_cities").Select("article_cities.article_id").
				Joins("JOIN cities ON cities.id = article_cities.city_id").
				Where("cities.id = ?", cityID)
			if countryCode != "" {
				articleIDs = articleIDs.Where("cities.country_code = ?", countryCode)
			}
			query = query.Where("articles.id IN (?)", articleIDs)
		} else if countryCode != "" {
			articleIDs := db.Table("article_cities").Select("article_cities.article_id").
				Joins("JOIN cities ON cities.id = article_cities.city_id").
				Where("cities.country_code = ?", countryCode)
			query = query.Where("articles.id IN (?)", articleIDs)
		}
		var totalCount int64
		countQuery := db.Model(&Article{})
		if !includeDrafts {
			countQuery = countQuery.Where("status = ?", "published")
		}
		if category := normalizeSlug(c.Query("category")); category != "" {
			countQuery = countQuery.Where("category = ?", canonicalCategory(category))
		}
		if search := strings.TrimSpace(c.Query("q")); search != "" {
			pattern := "%" + search + "%"
			countQuery = countQuery.Where("(title LIKE ? OR summary LIKE ?)", pattern, pattern)
		}
		if cityID := strings.TrimSpace(c.Query("city")); cityID != "" {
			articleIDs := db.Table("article_cities").Select("article_cities.article_id").
				Joins("JOIN cities ON cities.id = article_cities.city_id").
				Where("cities.id = ?", cityID)
			if countryCode != "" {
				articleIDs = articleIDs.Where("cities.country_code = ?", countryCode)
			}
			countQuery = countQuery.Where("articles.id IN (?)", articleIDs)
		} else if countryCode != "" {
			articleIDs := db.Table("article_cities").Select("article_cities.article_id").
				Joins("JOIN cities ON cities.id = article_cities.city_id").
				Where("cities.country_code = ?", countryCode)
			countQuery = countQuery.Where("articles.id IN (?)", articleIDs)
		}
		countQuery.Count(&totalCount)

		pageStr := c.Query("page")
		hasPage := pageStr != ""
		page := 1
		if hasPage {
			parsedPage, err := strconv.Atoi(pageStr)
			if err == nil && parsedPage > 0 {
				page = parsedPage
			}
		}

		limitVal := 0
		if !includeDrafts {
			limit, err := queryInt(c, "limit", 0)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "limit must be a positive integer"})
				return
			}
			offset, err := queryInt(c, "offset", 0)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "offset must be a non-negative integer"})
				return
			}
			if hasPage && limit == 0 {
				limit = 10
			}
			if hasPage {
				offset = (page - 1) * limit
			}
			if limit > 0 {
				if limit > 100 {
					limit = 100
				}
				limitVal = limit
				query = query.Limit(limit).Offset(offset)
			} else if offset > 0 {
				query = query.Offset(offset)
			}
		}
		var articles []Article
		if err := query.Find(&articles).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "articles could not be loaded"})
			return
		}

		totalPages := 1
		if limitVal > 0 {
			totalPages = int(math.Ceil(float64(totalCount) / float64(limitVal)))
		}

		c.Header("X-Total-Count", strconv.FormatInt(totalCount, 10))
		c.Header("X-Total-Pages", strconv.Itoa(totalPages))
		c.Header("X-Current-Page", strconv.Itoa(page))
		c.Header("X-Page-Limit", strconv.Itoa(limitVal))

		if hasPage || c.Query("with_meta") == "true" {
			c.JSON(http.StatusOK, gin.H{
				"data":        articles,
				"page":        page,
				"limit":       limitVal,
				"total_count": totalCount,
				"total_pages": totalPages,
			})
			return
		}
		c.JSON(http.StatusOK, articles)
	}
}

func getSiteSettings(c *gin.Context) {
	var settings []SiteSetting
	db.Find(&settings)
	settingsMap := map[string]string{
		"company_name":             "체크인데일리 미디어그룹",
		"representative":          "원섭",
		"business_number":         "2026-04-52914",
		"mail_order_number":       "2026-서울중구-0123",
		"newspaper_number":        "서울 아-52914",
		"youth_protection_officer": "원섭",
		"publisher":                "원섭",
		"address":                  "서울특별시 중구 을지로 100 파인에비뉴 B동",
		"contact_email":            "editorial@checkindaily.com",
		"contact_phone":            "02-738-2026",
		"site_url":                 "https://travel-checkin-daily.dnjstjqppk.workers.dev",
		"brand_name":               "CHECK-IN",
		"brand_subname":            "DAILY",
		"slogan":                   "글로벌 여행 인텔리전스 & 마켓 트렌드 뉴스 미디어",
		"description":              "전 세계 항공, 호텔, 여행지 트렌드 및 여행 정책을 가장 빠르고 깊이 있게 전달하는 글로벌 여행 전문 디지털 뉴스룸",
	}
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}
	c.JSON(http.StatusOK, settingsMap)
}

func updateSiteSettings(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for k, v := range input {
		valStr := fmt.Sprintf("%v", v)
		setting := SiteSetting{Key: k, Value: valStr, UpdatedAt: now}
		db.Save(&setting)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "settings updated successfully"})
}

func queryInt(c *gin.Context, key string, fallback int) (int, error) {
	value := c.Query(key)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 || (key == "limit" && parsed == 0) {
		return 0, fmt.Errorf("%s must be a valid integer", key)
	}
	return parsed, nil
}

func getArticle(includeDrafts bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := db.Preload("Cities.Country").Where("slug = ?", normalizeSlug(c.Param("slug")))
		if !includeDrafts {
			query = query.Where("status = ?", "published")
		}
		var article Article
		if err := query.First(&article).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
			return
		}
		if !includeDrafts {
			if err := db.Model(&Article{}).Where("id = ?", article.ID).UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "article view could not be recorded"})
				return
			}
			article.ViewCount++
		}
		c.JSON(http.StatusOK, article)
	}
}

func parsePositiveID(raw string) (uint, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return 0, errors.New("id is required")
	}
	val, err := strconv.ParseUint(trimmed, 10, 32)
	if err != nil || val == 0 {
		return 0, errors.New("id must be a positive integer")
	}
	return uint(val), nil
}

func getAdminArticle(c *gin.Context) {
	id, err := parsePositiveID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid article id: must be a positive integer"})
		return
	}
	var article Article
	if err := db.Preload("Cities.Country").Where("id = ?", id).First(&article).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
	c.JSON(http.StatusOK, article)
}

func getArticleByID(c *gin.Context) {
	id, err := parsePositiveID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid article id: must be a positive integer"})
		return
	}
	var article Article
	query := db.Preload("Cities.Country").Where("id = ?", id).Where("status = ?", "published")
	if category := canonicalCategory(normalizeSlug(c.Query("category"))); category != "" {
		query = query.Where("category = ?", category)
	}
	if err := query.First(&article).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
	if err := db.Model(&Article{}).Where("id = ?", article.ID).UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "article view could not be recorded"})
		return
	}
	article.ViewCount++
	c.JSON(http.StatusOK, article)
}

func createArticle(c *gin.Context) {
	var input ArticleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	exists, err := categoryExists(input.Category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "article categories could not be checked"})
		return
	}
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown article category"})
		return
	}
	input.Category = canonicalCategory(normalizeSlug(input.Category))
	if err := validateCityIDs(db, input.CityIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "one or more selected cities do not exist"})
		return
	}

	// Server-side validation for public publishing (drafts bypass these rules)
	if input.Status == "published" {
		valid, textLen, imgCount, errs := validateArticleForPublish(input.Content, input.CoverImage)
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":      "validation_failed",
				"message":    "기사 발행 조건(본문 텍스트 800~2,000자, 본문 이미지 4~10장)을 충족하지 못했습니다.",
				"textLength": textLen,
				"imageCount": imgCount,
				"errors":     errs,
			})
			return
		}
	}

	article := articleFromInput(input)
	if article.Slug == "" || article.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "article title and slug must not be blank"})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&article).Error; err != nil {
			return err
		}
		return replaceArticleCities(tx, &article, input.CityIDs)
	}); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "article could not be created; check that the slug is unique"})
		return
	}
	if err := db.Preload("Cities.Country").First(&article, article.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "article could not be loaded after creation"})
		return
	}
	c.JSON(http.StatusCreated, article)
}

func updateArticle(c *gin.Context) {
	id, err := parsePositiveID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid article id: must be a positive integer"})
		return
	}
	var article Article
	if err := db.Where("id = ?", id).First(&article).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
	var input ArticleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	exists, err := categoryExists(input.Category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "article categories could not be checked"})
		return
	}
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown article category"})
		return
	}
	input.Category = canonicalCategory(normalizeSlug(input.Category))
	if err := validateCityIDs(db, input.CityIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "one or more selected cities do not exist"})
		return
	}

	// Server-side validation for public publishing (drafts bypass these rules)
	if input.Status == "published" {
		valid, textLen, imgCount, errs := validateArticleForPublish(input.Content, input.CoverImage)
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":      "validation_failed",
				"message":    "기사 발행 조건(본문 텍스트 800~2,000자, 본문 이미지 4~10장)을 충족하지 못했습니다.",
				"textLength": textLen,
				"imageCount": imgCount,
				"errors":     errs,
			})
			return
		}
	}

	updated := articleFromInput(input)
	if updated.Slug == "" || updated.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "article title and slug must not be blank"})
		return
	}
	updated.ID = article.ID
	updated.CreatedAt = article.CreatedAt

	// Preserve FirstPublishedAt and PublishedAt
	if article.FirstPublishedAt != nil {
		updated.FirstPublishedAt = article.FirstPublishedAt
	} else if input.Status == "published" {
		now := time.Now().UTC()
		updated.FirstPublishedAt = &now
	}

	if article.PublishedAt != nil && input.Status == "published" {
		updated.PublishedAt = article.PublishedAt
	} else if input.Status == "published" {
		now := time.Now().UTC()
		updated.PublishedAt = &now
	} else if input.Status == "draft" {
		updated.PublishedAt = nil
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&article).Select("Title", "Slug", "Summary", "Content", "Category", "Author", "CoverImage", "Status", "PublishedAt", "FirstPublishedAt").Updates(updated).Error; err != nil {
			return err
		}
		return replaceArticleCities(tx, &article, input.CityIDs)
	}); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "article could not be updated; check that the slug is unique"})
		return
	}
	if err := db.Preload("Cities.Country").First(&article, article.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "article could not be loaded after update"})
		return
	}
	c.JSON(http.StatusOK, article)
}

func deleteArticle(c *gin.Context) {
	id, err := parsePositiveID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid article id: must be a positive integer"})
		return
	}
	var result *gorm.DB
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM article_cities WHERE article_id = ?", id).Error; err != nil {
			return err
		}
		result = tx.Where("id = ?", id).Delete(&Article{})
		return result.Error
	}); err != nil {
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
	id, err := parsePositiveID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category id: must be a positive integer"})
		return
	}
	var category Category
	if err := db.Where("id = ?", id).First(&category).Error; err != nil {
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
	id, err := parsePositiveID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category id: must be a positive integer"})
		return
	}
	var category Category
	if err := db.Where("id = ?", id).First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	var articleCount int64
	db.Model(&Article{}).Where("category = ?", category.Slug).Count(&articleCount)
	if articleCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "category is used by existing articles"})
		return
	}
	if err := db.Where("id = ?", id).Delete(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "category could not be deleted"})
		return
	}
	c.Status(http.StatusNoContent)
}

func listCountries(c *gin.Context) {
	var countries []Country
	if err := db.Order("sort_order asc, name_en asc").Find(&countries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "countries could not be loaded"})
		return
	}
	c.JSON(http.StatusOK, countries)
}

func listCities(c *gin.Context) {
	countryCode := strings.ToUpper(strings.TrimSpace(c.Param("code")))
	exists, err := countryExists(countryCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "country could not be checked"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "country not found"})
		return
	}
	var cities []City
	if err := db.Where("country_code = ?", countryCode).Order("name_en asc").Find(&cities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cities could not be loaded"})
		return
	}
	c.JSON(http.StatusOK, cities)
}

func createCountry(c *gin.Context) {
	var input CountryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	country := countryFromInput(input)
	if !validCountryCode(country.Code) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "country code must contain two letters"})
		return
	}
	if country.NameKo == "" || country.NameEn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "country names must not be blank"})
		return
	}
	if err := db.Create(&country).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "country could not be created; check that the code is unique"})
		return
	}
	c.JSON(http.StatusCreated, country)
}

func updateCountry(c *gin.Context) {
	var country Country
	code := strings.ToUpper(strings.TrimSpace(c.Param("code")))
	if err := db.First(&country, "code = ?", code).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "country not found"})
		return
	}
	var input CountryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.ToUpper(strings.TrimSpace(input.Code)) != code {
		c.JSON(http.StatusBadRequest, gin.H{"error": "country code cannot be changed"})
		return
	}
	updated := countryFromInput(input)
	if updated.NameKo == "" || updated.NameEn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "country names must not be blank"})
		return
	}
	if err := db.Model(&country).Select("NameKo", "NameEn", "Continent", "SortOrder").Updates(updated).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "country could not be updated"})
		return
	}
	if err := db.First(&country, "code = ?", code).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "country could not be loaded after update"})
		return
	}
	c.JSON(http.StatusOK, country)
}

func deleteCountry(c *gin.Context) {
	code := strings.ToUpper(strings.TrimSpace(c.Param("code")))
	var country Country
	if err := db.First(&country, "code = ?", code).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "country not found"})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM article_cities WHERE city_id IN (SELECT id FROM cities WHERE country_code = ?)", code).Error; err != nil {
			return err
		}
		if err := tx.Where("country_code = ?", code).Delete(&City{}).Error; err != nil {
			return err
		}
		return tx.Delete(&country).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "country could not be deleted"})
		return
	}
	c.Status(http.StatusNoContent)
}

func createCity(c *gin.Context) {
	countryCode := strings.ToUpper(strings.TrimSpace(c.Param("code")))
	exists, err := countryExists(countryCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "country could not be checked"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "country not found"})
		return
	}
	var input CityInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	city := cityFromInput(input, countryCode)
	if city.ID == "" || city.NameKo == "" || city.NameEn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "city id and names must not be blank"})
		return
	}
	if err := db.Create(&city).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "city could not be created; check that its id is unique"})
		return
	}
	c.JSON(http.StatusCreated, city)
}

func updateCity(c *gin.Context) {
	var city City
	if err := db.First(&city, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "city not found"})
		return
	}
	var input CityInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if id := normalizeSlug(input.ID); id == "" || id != city.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "city id cannot be changed"})
		return
	}
	nameKo := strings.TrimSpace(input.NameKo)
	nameEn := strings.TrimSpace(input.NameEn)
	if nameKo == "" || nameEn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "city names must not be blank"})
		return
	}
	city.NameKo = nameKo
	city.NameEn = nameEn
	if err := db.Save(&city).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "city could not be updated"})
		return
	}
	c.JSON(http.StatusOK, city)
}

func deleteCity(c *gin.Context) {
	var city City
	if err := db.First(&city, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "city not found"})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM article_cities WHERE city_id = ?", city.ID).Error; err != nil {
			return err
		}
		return tx.Delete(&city).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "city could not be deleted"})
		return
	}
	c.Status(http.StatusNoContent)
}

func listAdPlacements(admin bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := db.Order("id asc")
		if !admin {
			query = query.Where("is_active = ?", true)
		}
		var placements []AdPlacement
		if err := query.Find(&placements).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ad placements could not be loaded"})
			return
		}
		c.JSON(http.StatusOK, placements)
	}
}

func createAdPlacement(c *gin.Context) {
	var input AdPlacementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	placement, err := adPlacementFromInput(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Create(&placement).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "ad placement could not be created; check that the id is unique"})
		return
	}
	c.JSON(http.StatusCreated, placement)
}

func updateAdPlacement(c *gin.Context) {
	var existing AdPlacement
	if err := db.First(&existing, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ad placement not found"})
		return
	}
	var input AdPlacementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	placement, err := adPlacementFromInput(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if placement.ID != existing.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ad placement id cannot be changed"})
		return
	}
	placement.CreatedAt = existing.CreatedAt
	if err := db.Model(&existing).Select("Name", "AdClientID", "AdSlotID", "Format", "IsActive").Updates(placement).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ad placement could not be updated"})
		return
	}
	if err := db.First(&existing, "id = ?", existing.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ad placement could not be loaded after update"})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func deleteAdPlacement(c *gin.Context) {
	result := db.Delete(&AdPlacement{}, "id = ?", c.Param("id"))
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ad placement could not be deleted"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ad placement not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func normalizeAdPlacementID(raw string) string {
	raw = strings.TrimSpace(strings.ToLower(raw))
	var b strings.Builder
	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		}
	}
	return strings.Trim(b.String(), "-_")
}

func adPlacementFromInput(input AdPlacementInput) (AdPlacement, error) {
	placement := AdPlacement{
		ID:         normalizeAdPlacementID(input.ID),
		Name:       strings.TrimSpace(input.Name),
		AdClientID: strings.TrimSpace(input.AdClientID),
		AdSlotID:   strings.TrimSpace(input.AdSlotID),
		Format:     strings.TrimSpace(input.Format),
		IsActive:   input.IsActive,
	}
	if placement.ID == "" || placement.Name == "" {
		return AdPlacement{}, fmt.Errorf("ad placement id and name must not be blank")
	}
	if placement.Format == "" {
		placement.Format = "auto"
	}
	if placement.IsActive && (placement.AdClientID == "" || placement.AdSlotID == "") {
		return AdPlacement{}, fmt.Errorf("active ad placements require a client id and slot id")
	}
	if placement.IsActive && (!adClientPattern.MatchString(placement.AdClientID) || !adSlotPattern.MatchString(placement.AdSlotID)) {
		return AdPlacement{}, fmt.Errorf("active ad placements require valid AdSense ids")
	}
	return placement, nil
}

func categoryExists(slug string) (bool, error) {
	normalized := canonicalCategory(normalizeSlug(slug))
	if normalized == "" {
		return false, nil
	}
	var count int64
	err := db.Model(&Category{}).Where("slug = ?", normalized).Count(&count).Error
	return count > 0, err
}

func countryExists(code string) (bool, error) {
	var count int64
	err := db.Model(&Country{}).Where("code = ?", strings.ToUpper(code)).Count(&count).Error
	return count > 0, err
}

func validCountryCode(code string) bool {
	return len(code) == 2 && code[0] >= 'A' && code[0] <= 'Z' && code[1] >= 'A' && code[1] <= 'Z'
}

func countryFromInput(input CountryInput) Country {
	return Country{
		Code:      strings.ToUpper(strings.TrimSpace(input.Code)),
		NameKo:    strings.TrimSpace(input.NameKo),
		NameEn:    strings.TrimSpace(input.NameEn),
		Continent: strings.TrimSpace(input.Continent),
		SortOrder: input.SortOrder,
	}
}

func cityFromInput(input CityInput, countryCode string) City {
	return City{
		ID:          normalizeSlug(input.ID),
		CountryCode: countryCode,
		NameKo:      strings.TrimSpace(input.NameKo),
		NameEn:      strings.TrimSpace(input.NameEn),
	}
}

func replaceArticleCities(tx *gorm.DB, article *Article, ids []string) error {
	uniqueIDs := make(map[string]struct{}, len(ids))
	cities := make([]City, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := uniqueIDs[id]; exists {
			continue
		}
		uniqueIDs[id] = struct{}{}
		var city City
		if err := tx.First(&city, "id = ?", id).Error; err != nil {
			return err
		}
		cities = append(cities, city)
	}
	return tx.Model(article).Association("Cities").Replace(cities)
}

func validateCityIDs(tx *gorm.DB, ids []string) error {
	uniqueIDs := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := uniqueIDs[id]; exists {
			continue
		}
		uniqueIDs[id] = struct{}{}
		var count int64
		if err := tx.Model(&City{}).Where("id = ?", id).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return gorm.ErrRecordNotFound
		}
	}
	return nil
}

func canonicalCategory(slug string) string {
	switch slug {
	case "flights":
		return "airline"
	case "hotels":
		return "hotel"
	case "industry":
		return "major"
	default:
		return slug
	}
}

func migrateCategorySlugs() error {
	aliases := map[string]string{"flights": "airline", "hotels": "hotel", "industry": "major"}
	return db.Transaction(func(tx *gorm.DB) error {
		for oldSlug, newSlug := range aliases {
			var oldCategory Category
			err := tx.First(&oldCategory, "slug = ?", oldSlug).Error
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					continue
				}
				return err
			}
			var newCategory Category
			err = tx.First(&newCategory, "slug = ?", newSlug).Error
			if err == nil {
				if err := tx.Model(&Article{}).Where("category = ?", oldSlug).Update("category", newSlug).Error; err != nil {
					return err
				}
				if err := tx.Delete(&oldCategory).Error; err != nil {
					return err
				}
				continue
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			oldCategory.Slug = newSlug
			switch newSlug {
			case "airline":
				oldCategory.Name = "항공"
			case "hotel":
				oldCategory.Name = "호텔"
			case "major":
				oldCategory.Name = "주요뉴스"
			}
			if err := tx.Save(&oldCategory).Error; err != nil {
				return err
			}
			if err := tx.Model(&Article{}).Where("category = ?", oldSlug).Update("category", newSlug).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

var slugPattern = regexp.MustCompile(`[^\p{L}\p{N}]+`)
var adClientPattern = regexp.MustCompile(`^ca-pub-[0-9]+$`)
var adSlotPattern = regexp.MustCompile(`^[0-9]+$`)

func normalizeSlug(slug string) string {
	normalized := strings.TrimSpace(slug)
	normalized = strings.ToLower(normalized)
	normalized = slugPattern.ReplaceAllString(normalized, "-")
	return strings.Trim(normalized, "-")
}

func articleFromInput(input ArticleInput) Article {
	input.Slug = normalizeSlug(input.Slug)
	input.Title = strings.TrimSpace(input.Title)
	input.Category = normalizeSlug(input.Category)
	input.Author = strings.TrimSpace(input.Author)
	input.CoverImage = strings.TrimSpace(input.CoverImage)
	input.Status = strings.TrimSpace(input.Status)
	article := Article{
		Title: input.Title, Slug: input.Slug, Summary: strings.TrimSpace(input.Summary), Content: input.Content,
		Category: input.Category, Author: input.Author, CoverImage: input.CoverImage, Status: input.Status,
	}
	if input.Status == "published" {
		publishedAt := time.Now().UTC()
		article.PublishedAt = &publishedAt
	}
	return article
}

var (
	reCodeBlock = regexp.MustCompile("(?s)```.*?```")
	reMdImg     = regexp.MustCompile(`!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["'][^"']*["'])?\s*\)`)
	reHtmlImg   = regexp.MustCompile(`(?i)<img\b[^>]*>`)
	reMdLink    = regexp.MustCompile(`\[([^\]]+)\]\([^)]*\)`)
	reHtmlTag   = regexp.MustCompile(`(?i)</?[^>]+(>|$)`)
	reHeadings  = regexp.MustCompile(`(?m)^#{1,6}\s+`)
	reQuotes    = regexp.MustCompile(`(?m)^>\s*`)
	reList      = regexp.MustCompile(`(?m)^[\t ]*([-*+]|\d+\.)\s+`)
	reHr        = regexp.MustCompile(`(?m)^[\t ]*[-*_]{3,}[\t ]*$`)
	reEmphasis  = regexp.MustCompile(`\*\*|__|\*|_|~~`)
	reCodeTicks = regexp.MustCompile("`([^`]+)`")
	reFootnotes = regexp.MustCompile(`\[\^[^\]]+\]`)
	reSpaces    = regexp.MustCompile(`\s+`)
	reSrcAttr   = regexp.MustCompile(`(?i)\bsrc=["']([^"']+)["']`)
)

func extractBodyPlainText(content string) string {
	text := reCodeBlock.ReplaceAllString(content, "")
	text = reMdImg.ReplaceAllString(text, "")
	text = reHtmlImg.ReplaceAllString(text, "")
	text = reMdLink.ReplaceAllString(text, "$1")
	text = reHtmlTag.ReplaceAllString(text, "")
	text = reHeadings.ReplaceAllString(text, "")
	text = reQuotes.ReplaceAllString(text, "")
	text = reList.ReplaceAllString(text, "")
	text = reHr.ReplaceAllString(text, "")
	text = reEmphasis.ReplaceAllString(text, "")
	text = reCodeTicks.ReplaceAllString(text, "$1")
	text = reFootnotes.ReplaceAllString(text, "")
	text = reSpaces.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func calculateBodyTextLength(content string) int {
	plain := extractBodyPlainText(content)
	return len([]rune(plain))
}

func extractBodyImages(content string, coverImage string) []string {
	seen := make(map[string]bool)
	var images []string
	normCover := strings.TrimSpace(strings.ToLower(coverImage))

	// Markdown images
	for _, match := range reMdImg.FindAllStringSubmatch(content, -1) {
		if len(match) >= 3 {
			url := strings.TrimSpace(match[2])
			lower := strings.ToLower(url)
			if isValidImgUrl(lower, normCover) && !seen[lower] {
				seen[lower] = true
				images = append(images, url)
			}
		}
	}

	// HTML images
	for _, tag := range reHtmlImg.FindAllString(content, -1) {
		srcMatch := reSrcAttr.FindStringSubmatch(tag)
		if len(srcMatch) >= 2 {
			url := strings.TrimSpace(srcMatch[1])
			lower := strings.ToLower(url)
			if isValidImgUrl(lower, normCover) && !seen[lower] {
				seen[lower] = true
				images = append(images, url)
			}
		}
	}
	return images
}

func isValidImgUrl(url, normCover string) bool {
	if len(url) < 5 || strings.HasPrefix(url, "blob:") || strings.HasPrefix(url, "javascript:") || strings.HasPrefix(url, "data:") {
		return false
	}
	if normCover != "" && url == normCover {
		return false
	}
	return strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") || strings.HasPrefix(url, "/api/media/") || strings.HasPrefix(url, "/images/") || strings.HasPrefix(url, "/assets/")
}

func validateArticleForPublish(content string, coverImage string) (bool, int, int, []string) {
	textLen := calculateBodyTextLength(content)
	imgs := extractBodyImages(content, coverImage)
	imgCount := len(imgs)
	var errors []string

	if textLen < 800 {
		errors = append(errors, fmt.Sprintf("본문 텍스트가 부족합니다. 최소 800자 이상이어야 합니다. (현재 %d자, %d자 부족)", textLen, 800-textLen))
	} else if textLen > 2000 {
		errors = append(errors, fmt.Sprintf("본문 텍스트가 초과되었습니다. 최대 2,000자 이하여야 합니다. (현재 %d자, %d자 초과)", textLen, textLen-2000))
	}

	if imgCount < 4 {
		errors = append(errors, fmt.Sprintf("본문 이미지가 부족합니다. 최소 4장 이상이어야 합니다. (현재 %d장, %d장 부족)", imgCount, 4-imgCount))
	} else if imgCount > 10 {
		errors = append(errors, fmt.Sprintf("본문 이미지가 초과되었습니다. 최대 10장까지 허용됩니다. (현재 %d장, %d장 초과)", imgCount, imgCount-10))
	}

	valid := len(errors) == 0
	return valid, textLen, imgCount, errors
}

func seedArticles() error {
	categories := []Category{
		{Name: "주요뉴스", Slug: "major"},
		{Name: "항공", Slug: "airline"},
		{Name: "호텔", Slug: "hotel"},
		{Name: "여행지", Slug: "destination"},
		{Name: "실시간 뉴스", Slug: "realtime"},
	}
	for _, category := range categories {
		if err := db.FirstOrCreate(&category, Category{Slug: category.Slug}).Error; err != nil {
			return err
		}
	}
	var count int64
	if err := db.Model(&Article{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	now := time.Now().UTC()
	articles := []Article{
		{Title: "마일리지 발권, 유류할증료까지 계산해야 하는 이유", Slug: "mileage-ticket-fees", Summary: "마일리지 좌석만 보던 시대는 끝났습니다. 발권 전 체크할 비용과 조건을 정리했습니다.", Content: "## 발권 전에 총액을 보세요\n\n마일리지 차감액뿐 아니라 유류할증료와 공항세를 함께 비교해야 합니다.\n\n- 출발일별 부과액 확인\n- 변경 및 취소 수수료 확인\n- 편도 여정도 별도 검색", Category: "airline", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
		{Title: "호텔 티어 혜택, 체크인 전에 확인할 세 가지", Slug: "hotel-status-checkin-benefits", Summary: "객실 업그레이드부터 레이트 체크아웃까지, 예약 채널과 투숙 조건이 혜택을 바꿉니다.", Content: "## 예약 조건이 혜택을 좌우합니다\n\n공식 채널 예약 여부와 체크인 시점의 객실 상황을 함께 살펴보세요.\n\n1. 회원 번호가 예약에 연결됐는지 확인합니다.\n2. 조식 및 라운지 동반 규정을 확인합니다.\n3. 레이트 체크아웃 시간을 프런트에 재확인합니다.", Category: "hotel", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
		{Title: "여행 업계 브리핑: 이번 주의 변화", Slug: "travel-industry-briefing", Summary: "항공과 호텔 업계의 주요 정책 변화를 한눈에 확인하세요.", Content: "## 이번 주 핵심\n\n새로운 운임 조건과 호텔 멤버십 정책은 예약 전에 공식 안내를 확인하는 것이 좋습니다.", Category: "major", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
		{Title: "도쿄 공항 이동 전 확인할 교통 안내", Slug: "tokyo-airport-transit-update", Summary: "여행 당일 공항과 도심을 잇는 교통편 운행 정보를 확인하세요.", Content: "## 출발 전 교통편을 확인하세요\n\n공항철도와 버스는 운행 시간 및 승차 위치가 변경될 수 있으므로 출발 전에 운영사 공지를 확인하세요.", Category: "realtime", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
		{Title: "파리 여행 전 알아둘 도심 이동 팁", Slug: "paris-city-transit-guide", Summary: "박물관과 주요 명소를 둘러보기 전 대중교통 이용 정보를 확인하세요.", Content: "## 파리 도심 이동\n\n방문 시기별 교통 운영 정보와 박물관 휴관일을 공식 안내에서 미리 확인하세요.", Category: "destination", Author: "체크인데일리 편집팀", Status: "published", PublishedAt: &now},
	}
	if err := db.Create(&articles).Error; err != nil {
		return err
	}
	if err := db.Model(&articles[0]).Association("Cities").Append(&City{ID: "tyo"}); err != nil {
		return err
	}
	if err := db.Model(&articles[1]).Association("Cities").Append(&City{ID: "tyo"}, &City{ID: "par"}); err != nil {
		return err
	}
	if err := db.Model(&articles[3]).Association("Cities").Append(&City{ID: "tyo"}); err != nil {
		return err
	}
	return db.Model(&articles[4]).Association("Cities").Append(&City{ID: "par"})
}

func seedLocations() error {
	countries := []Country{
		{Code: "KR", NameKo: "대한민국", NameEn: "South Korea", Continent: "Asia", SortOrder: 1},
		{Code: "JP", NameKo: "일본", NameEn: "Japan", Continent: "Asia", SortOrder: 2},
		{Code: "US", NameKo: "미국", NameEn: "United States", Continent: "North America", SortOrder: 3},
		{Code: "FR", NameKo: "프랑스", NameEn: "France", Continent: "Europe", SortOrder: 4},
		{Code: "IT", NameKo: "이탈리아", NameEn: "Italy", Continent: "Europe", SortOrder: 5},
		{Code: "TH", NameKo: "태국", NameEn: "Thailand", Continent: "Asia", SortOrder: 6},
		{Code: "VN", NameKo: "베트남", NameEn: "Vietnam", Continent: "Asia", SortOrder: 7},
		{Code: "SG", NameKo: "싱가포르", NameEn: "Singapore", Continent: "Asia", SortOrder: 8},
		{Code: "GB", NameKo: "영국", NameEn: "United Kingdom", Continent: "Europe", SortOrder: 9},
		{Code: "AU", NameKo: "호주", NameEn: "Australia", Continent: "Oceania", SortOrder: 10},
	}
	for _, country := range countries {
		if err := db.FirstOrCreate(&country, Country{Code: country.Code}).Error; err != nil {
			return err
		}
	}
	cities := []City{
		{ID: "sel", CountryCode: "KR", NameKo: "서울", NameEn: "Seoul"},
		{ID: "pus", CountryCode: "KR", NameKo: "부산", NameEn: "Busan"},
		{ID: "cju", CountryCode: "KR", NameKo: "제주", NameEn: "Jeju"},
		{ID: "tyo", CountryCode: "JP", NameKo: "도쿄", NameEn: "Tokyo"},
		{ID: "osa", CountryCode: "JP", NameKo: "오사카", NameEn: "Osaka"},
		{ID: "sap", CountryCode: "JP", NameKo: "삿포로", NameEn: "Sapporo"},
		{ID: "nyc", CountryCode: "US", NameKo: "뉴욕", NameEn: "New York"},
		{ID: "sfo", CountryCode: "US", NameKo: "샌프란시스코", NameEn: "San Francisco"},
		{ID: "lax", CountryCode: "US", NameKo: "로스앤젤레스", NameEn: "Los Angeles"},
		{ID: "par", CountryCode: "FR", NameKo: "파리", NameEn: "Paris"},
		{ID: "rom", CountryCode: "IT", NameKo: "로마", NameEn: "Rome"},
		{ID: "bkk", CountryCode: "TH", NameKo: "방콕", NameEn: "Bangkok"},
		{ID: "sgn", CountryCode: "VN", NameKo: "호찌민", NameEn: "Ho Chi Minh City"},
		{ID: "sin", CountryCode: "SG", NameKo: "싱가포르", NameEn: "Singapore"},
		{ID: "lon", CountryCode: "GB", NameKo: "런던", NameEn: "London"},
		{ID: "syd", CountryCode: "AU", NameKo: "시드니", NameEn: "Sydney"},
	}
	for _, city := range cities {
		if err := db.FirstOrCreate(&city, City{ID: city.ID}).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedAdPlacements() error {
	placements := []AdPlacement{
		{ID: "main_top", Name: "메인 상단 · 헤드라인 위", Format: "auto"},
		{ID: "main_mid", Name: "메인 피드 중간 · 히어로와 갤러리 사이", Format: "auto"},
		{ID: "main_bottom", Name: "메인 갤러리 하단", Format: "auto"},
		{ID: "list_inline_1", Name: "뉴스 목록 · 4번째 카드 다음", Format: "auto"},
		{ID: "list_inline_2", Name: "뉴스 목록 · 8번째 카드 다음", Format: "auto"},
		{ID: "list_inline_3", Name: "뉴스 목록 · 12번째 카드 다음", Format: "auto"},
		{ID: "sidebar_rect", Name: "사이드바 사각형", Format: "rectangle"},
		{ID: "article_top", Name: "기사 상세 · 제목과 본문 사이", Format: "auto"},
		{ID: "article_mid", Name: "기사 상세 · 본문 하단", Format: "auto"},
		{ID: "article_bottom", Name: "기사 상세 · 본문 다음", Format: "auto"},
		{ID: "article_related", Name: "기사 상세 · 추천 기사 위", Format: "auto"},
	}
	for _, placement := range placements {
		if err := db.FirstOrCreate(&placement, AdPlacement{ID: placement.ID}).Error; err != nil {
			return err
		}
	}
	return nil
}

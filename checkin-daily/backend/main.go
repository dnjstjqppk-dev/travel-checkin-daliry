package main

import (
	"errors"
	"fmt"
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
	Cities      []City     `json:"cities,omitempty" gorm:"many2many:article_cities;"`
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
	databasePath := os.Getenv("SQLITE_PATH")
	if databasePath == "" {
		databasePath = "checkin-daily.db"
	}
	var err error
	db, err = gorm.Open(sqlite.Open(databasePath), &gorm.Config{})
	if err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&Article{}, &Category{}, &Country{}, &City{}, &AdPlacement{}); err != nil {
		panic(err)
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

	router := gin.Default()
	router.Use(cors())
	router.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	router.GET("/api/categories", listCategories)
	router.GET("/api/admin/categories", listCategories)
	router.POST("/api/admin/categories", createCategory)
	router.PUT("/api/admin/categories/:id", updateCategory)
	router.DELETE("/api/admin/categories/:id", deleteCategory)
	router.GET("/api/countries", listCountries)
	router.GET("/api/countries/:code/cities", listCities)
	router.GET("/api/admin/countries", listCountries)
	router.POST("/api/admin/countries", createCountry)
	router.PUT("/api/admin/countries/:code", updateCountry)
	router.DELETE("/api/admin/countries/:code", deleteCountry)
	router.GET("/api/admin/countries/:code/cities", listCities)
	router.POST("/api/admin/countries/:code/cities", createCity)
	router.PUT("/api/admin/cities/:id", updateCity)
	router.DELETE("/api/admin/cities/:id", deleteCity)
	router.GET("/api/ads", listAdPlacements(false))
	router.GET("/api/admin/ads", listAdPlacements(true))
	router.POST("/api/admin/ads", createAdPlacement)
	router.PUT("/api/admin/ads/:id", updateAdPlacement)
	router.DELETE("/api/admin/ads/:id", deleteAdPlacement)
	router.GET("/api/articles", listArticles(false))
	router.GET("/api/articles/id/:id", getArticleByID)
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
		query := db.Model(&Article{}).Preload("Cities.Country").Order("published_at desc, created_at desc")
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
			if limit > 0 {
				if limit > 100 {
					limit = 100
				}
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
		c.JSON(http.StatusOK, articles)
	}
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
		c.JSON(http.StatusOK, article)
	}
}

func getArticleByID(c *gin.Context) {
	var article Article
	query := db.Preload("Cities.Country").Where("id = ?", c.Param("id")).Where("status = ?", "published")
	if category := canonicalCategory(normalizeSlug(c.Query("category"))); category != "" {
		query = query.Where("category = ?", category)
	}
	if err := query.First(&article).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
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
	updated := articleFromInput(input)
	if updated.Slug == "" || updated.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "article title and slug must not be blank"})
		return
	}
	updated.ID = article.ID
	updated.CreatedAt = article.CreatedAt
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&article).Select("Title", "Slug", "Summary", "Content", "Category", "Author", "CoverImage", "Status", "PublishedAt").Updates(updated).Error; err != nil {
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
	var result *gorm.DB
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM article_cities WHERE article_id = ?", c.Param("id")).Error; err != nil {
			return err
		}
		result = tx.Delete(&Article{}, c.Param("id"))
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
	if err := db.Model(&country).Updates(updated).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "country could not be updated"})
		return
	}
	c.JSON(http.StatusOK, updated)
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

func adPlacementFromInput(input AdPlacementInput) (AdPlacement, error) {
	placement := AdPlacement{
		ID:         normalizeSlug(input.ID),
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
		{ID: "main_top", Name: "메인 상단 배너", Format: "auto"},
		{ID: "sidebar_rect", Name: "사이드바 사각형", Format: "rectangle"},
		{ID: "article_top", Name: "기사 상단", Format: "auto"},
		{ID: "article_bottom", Name: "기사 하단", Format: "auto"},
	}
	for _, placement := range placements {
		if err := db.FirstOrCreate(&placement, AdPlacement{ID: placement.ID}).Error; err != nil {
			return err
		}
	}
	return nil
}

package main

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type NewsSourceModel struct {
	ID                   string    `json:"id" gorm:"primaryKey;size:50"`
	Name                 string    `json:"name" gorm:"size:120;not null"`
	SourceType           string    `json:"sourceType" gorm:"size:30;not null"`
	EndpointURL          string    `json:"endpointUrl" gorm:"size:255;not null"`
	FetchIntervalMinutes int       `json:"fetchIntervalMinutes" gorm:"not null;default:60"`
	LicenseInfo          string    `json:"licenseInfo" gorm:"size:255;not null"`
	IsActive             bool      `json:"isActive" gorm:"not null;default:true"`
	LastFetchedAt        *time.Time `json:"lastFetchedAt"`
	LastStatus           string    `json:"lastStatus" gorm:"size:20;not null;default:ok"`
	CreatedAt            time.Time `json:"createdAt"`
}

func (NewsSourceModel) TableName() string {
	return "news_sources"
}

type ContributorSubmissionModel struct {
	ID                 uint      `json:"id" gorm:"primaryKey"`
	OrgID              string    `json:"orgId" gorm:"size:50"`
	SubmitterName      string    `json:"submitterName" gorm:"size:80;not null"`
	SubmitterEmail     string    `json:"submitterEmail" gorm:"size:120;not null"`
	Title              string    `json:"title" gorm:"size:200;not null"`
	Summary            string    `json:"summary" gorm:"size:500"`
	Content            string    `json:"content" gorm:"type:text;not null"`
	Category           string    `json:"category" gorm:"size:60;not null"`
	CityIDs            string    `json:"cityIds" gorm:"size:255;default:'[]'"`
	AttachmentURLs     string    `json:"attachmentUrls" gorm:"type:text;default:'[]'"`
	SourceURL          string    `json:"sourceUrl" gorm:"size:255"`
	CopyrightProof     string    `json:"copyrightProof" gorm:"size:255"`
	Status             string    `json:"status" gorm:"size:30;not null;default:submitted"`
	EditorialFeedback  string    `json:"editorialFeedback" gorm:"size:500"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

func (ContributorSubmissionModel) TableName() string {
	return "contributor_submissions"
}

type FactCheckModel struct {
	ID                 uint      `json:"id" gorm:"primaryKey"`
	ArticleID          uint      `json:"articleId" gorm:"not null;index"`
	Claim              string    `json:"claim" gorm:"size:255;not null"`
	VerificationStatus string    `json:"verificationStatus" gorm:"size:30;not null;default:verified"`
	EvidenceURL        string    `json:"evidenceUrl" gorm:"size:255"`
	CheckedBy          string    `json:"checkedBy" gorm:"size:80"`
	Notes              string    `json:"notes" gorm:"size:500"`
	CheckedAt          time.Time `json:"checkedAt"`
}

func (FactCheckModel) TableName() string {
	return "article_fact_checks"
}

type ArticleTranslationModel struct {
	ArticleID uint      `json:"articleId" gorm:"primaryKey"`
	Lang      string    `json:"lang" gorm:"primaryKey;size:10"`
	Title     string    `json:"title" gorm:"size:200;not null"`
	Summary   string    `json:"summary" gorm:"size:500"`
	Content   string    `json:"content" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"createdAt"`
}

func (ArticleTranslationModel) TableName() string {
	return "article_translations"
}

type BookmarkModel struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"userId" gorm:"not null;index"`
	ArticleID uint      `json:"articleId" gorm:"not null;index"`
	CreatedAt time.Time `json:"createdAt"`
}

func (BookmarkModel) TableName() string {
	return "bookmarks"
}

func registerEnterpriseRoutes(router *gin.Engine, adminGroup *gin.RouterGroup) {
	// Auto migrate enterprise tables if DB available
	if db != nil {
		_ = db.AutoMigrate(
			&NewsSourceModel{},
			&ContributorSubmissionModel{},
			&FactCheckModel{},
			&ArticleTranslationModel{},
			&BookmarkModel{},
		)
		seedInitialEnterpriseData()
	}

	// Public / Reader APIs
	router.GET("/api/news-sources", listNewsSources)
	router.GET("/api/rankings", getArticleRankings)
	router.GET("/api/search", searchArticles)
	router.GET("/api/fact-checks", listFactChecks)
	router.GET("/api/translations", listTranslations)
	router.GET("/api/bookmarks", getBookmarks)
	router.POST("/api/bookmarks", toggleBookmark)

	// Partner & Contributor API
	router.POST("/api/partners/submissions", submitContributorArticle)
	router.GET("/api/partners/submissions", listContributorSubmissions)

	// Admin extensions
	if adminGroup != nil {
		adminGroup.GET("/submissions", listContributorSubmissions)
		adminGroup.PUT("/submissions/:id/review", reviewSubmission)
	}
}

func seedInitialEnterpriseData() {
	if db == nil {
		return
	}
	var count int64
	db.Model(&NewsSourceModel{}).Count(&count)
	if count == 0 {
		sources := []NewsSourceModel{
			{
				ID:                   "aot_official",
				Name:                 "Airports of Thailand (AOT)",
				SourceType:           "press_room",
				EndpointURL:          "https://www.mot.go.th/",
				FetchIntervalMinutes: 60,
				LicenseInfo:          "Official Government PR / Fair Quotation",
				IsActive:             true,
				LastStatus:           "ok",
			},
			{
				ID:                   "tat_newsroom",
				Name:                 "Tourism Authority of Thailand (TAT)",
				SourceType:           "press_room",
				EndpointURL:          "https://www.tatnews.org/",
				FetchIntervalMinutes: 60,
				LicenseInfo:          "Official Tourism Board Press Release",
				IsActive:             true,
				LastStatus:           "ok",
			},
			{
				ID:                   "pha_phuket",
				Name:                 "Phuket Hotels Association (PHA)",
				SourceType:           "press_room",
				EndpointURL:          "https://www.phukethotelsassociation.com/",
				FetchIntervalMinutes: 120,
				LicenseInfo:          "Industry Association Winter Trend Report",
				IsActive:             true,
				LastStatus:           "ok",
			},
			{
				ID:                   "srt_railway",
				Name:                 "State Railway of Thailand (SRT)",
				SourceType:           "press_room",
				EndpointURL:          "https://www.railway.co.th/",
				FetchIntervalMinutes: 120,
				LicenseInfo:          "State Enterprise Press Release",
				IsActive:             true,
				LastStatus:           "ok",
			},
		}
		for _, s := range sources {
			db.Create(&s)
		}
	}
}

func listNewsSources(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, []NewsSourceModel{})
		return
	}
	var sources []NewsSourceModel
	if err := db.Where("is_active = ?", true).Find(&sources).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch news sources"})
		return
	}
	c.JSON(http.StatusOK, sources)
}

func getArticleRankings(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, []Article{})
		return
	}
	var articles []Article
	query := db.Preload("Cities").Where("status = ?", "published").Order("view_count DESC, published_at DESC").Limit(10)
	if err := query.Find(&articles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rankings"})
		return
	}
	c.JSON(http.StatusOK, articles)
}

func searchArticles(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, gin.H{"results": []Article{}, "total": 0})
		return
	}
	q := strings.TrimSpace(c.Query("q"))
	category := strings.TrimSpace(c.Query("category"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	query := db.Model(&Article{}).Where("status = ?", "published")
	if q != "" {
		likePattern := "%" + q + "%"
		query = query.Where("title LIKE ? OR summary LIKE ? OR content LIKE ? OR author LIKE ?", likePattern, likePattern, likePattern, likePattern)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}

	var total int64
	query.Count(&total)

	var articles []Article
	offset := (page - 1) * pageSize
	if err := query.Preload("Cities").Order("published_at DESC").Offset(offset).Limit(pageSize).Find(&articles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search query failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results":  articles,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func listFactChecks(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, []FactCheckModel{})
		return
	}
	articleIDStr := c.Query("articleId")
	query := db.Model(&FactCheckModel{})
	if articleIDStr != "" {
		if id, err := strconv.Atoi(articleIDStr); err == nil {
			query = query.Where("article_id = ?", id)
		}
	}
	var checks []FactCheckModel
	if err := query.Find(&checks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query fact checks"})
		return
	}
	c.JSON(http.StatusOK, checks)
}

func listTranslations(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, []ArticleTranslationModel{})
		return
	}
	articleIDStr := c.Query("articleId")
	lang := c.Query("lang")
	query := db.Model(&ArticleTranslationModel{})
	if articleIDStr != "" {
		if id, err := strconv.Atoi(articleIDStr); err == nil {
			query = query.Where("article_id = ?", id)
		}
	}
	if lang != "" {
		query = query.Where("lang = ?", lang)
	}
	var translations []ArticleTranslationModel
	if err := query.Find(&translations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query translations"})
		return
	}
	c.JSON(http.StatusOK, translations)
}

func getBookmarks(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, []Article{})
		return
	}
	// Default demo user ID 1 for unauthenticated or reader sessions
	var bookmarks []BookmarkModel
	db.Where("user_id = ?", 1).Find(&bookmarks)
	var articleIDs []uint
	for _, b := range bookmarks {
		articleIDs = append(articleIDs, b.ArticleID)
	}

	if len(articleIDs) == 0 {
		c.JSON(http.StatusOK, []Article{})
		return
	}

	var articles []Article
	db.Preload("Cities").Where("id IN ?", articleIDs).Find(&articles)
	c.JSON(http.StatusOK, articles)
}

func toggleBookmark(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, gin.H{"bookmarked": false})
		return
	}
	var payload struct {
		ArticleID uint `json:"articleId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	var existing BookmarkModel
	res := db.Where("user_id = ? AND article_id = ?", 1, payload.ArticleID).First(&existing)
	if res.RowsAffected > 0 {
		db.Delete(&existing)
		c.JSON(http.StatusOK, gin.H{"bookmarked": false, "articleId": payload.ArticleID})
	} else {
		bookmark := BookmarkModel{
			UserID:    1,
			ArticleID: payload.ArticleID,
			CreatedAt: time.Now(),
		}
		db.Create(&bookmark)
		c.JSON(http.StatusOK, gin.H{"bookmarked": true, "articleId": payload.ArticleID})
	}
}

func submitContributorArticle(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database unavailable"})
		return
	}
	var input struct {
		OrgID          string `json:"orgId"`
		SubmitterName  string `json:"submitterName" binding:"required"`
		SubmitterEmail string `json:"submitterEmail" binding:"required,email"`
		Title          string `json:"title" binding:"required"`
		Summary        string `json:"summary"`
		Content        string `json:"content" binding:"required"`
		Category       string `json:"category" binding:"required"`
		CityIDs        string `json:"cityIds"`
		SourceURL      string `json:"sourceUrl"`
		CopyrightProof string `json:"copyrightProof"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	submission := ContributorSubmissionModel{
		OrgID:             input.OrgID,
		SubmitterName:     input.SubmitterName,
		SubmitterEmail:    input.SubmitterEmail,
		Title:             input.Title,
		Summary:           input.Summary,
		Content:           input.Content,
		Category:          input.Category,
		CityIDs:           input.CityIDs,
		SourceURL:         input.SourceURL,
		CopyrightProof:    input.CopyrightProof,
		Status:            "submitted",
		EditorialFeedback: "",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := db.Create(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save submission"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "보도자료/기고 기사가 성공적으로 접수되었습니다. 편집국 검토 후 통보됩니다.",
		"submission": submission,
	})
}

func listContributorSubmissions(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusOK, []ContributorSubmissionModel{})
		return
	}
	var submissions []ContributorSubmissionModel
	if err := db.Order("created_at DESC").Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list submissions"})
		return
	}
	c.JSON(http.StatusOK, submissions)
}

func reviewSubmission(c *gin.Context) {
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database unavailable"})
		return
	}
	id := c.Param("id")
	var submission ContributorSubmissionModel
	if err := db.First(&submission, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	var reviewPayload struct {
		Status            string `json:"status" binding:"required,oneof=approved rejected revision_requested"`
		EditorialFeedback string `json:"editorialFeedback"`
	}
	if err := c.ShouldBindJSON(&reviewPayload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	submission.Status = reviewPayload.Status
	submission.EditorialFeedback = reviewPayload.EditorialFeedback
	submission.UpdatedAt = time.Now()
	db.Save(&submission)

	c.JSON(http.StatusOK, gin.H{
		"message":    "검토 결과가 반영되었습니다.",
		"submission": submission,
	})
}


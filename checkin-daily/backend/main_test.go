package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestArticleFromInputNormalizesSlugAndPublication(t *testing.T) {
	article := articleFromInput(ArticleInput{
		Title:    "  Test story  ",
		Slug:     "  My Story  ",
		Category: "  Flights  ",
		Status:   "published",
	})
	if article.Title != "Test story" {
		t.Fatalf("expected trimmed title, got %q", article.Title)
	}
	if article.Slug != "my-story" {
		t.Fatalf("expected normalized slug, got %q", article.Slug)
	}
	if article.Category != "flights" {
		t.Fatalf("expected normalized category, got %q", article.Category)
	}
	if article.PublishedAt == nil {
		t.Fatal("published article must have a publication timestamp")
	}

	punctuated := articleFromInput(ArticleInput{Title: "A/B & C!", Slug: "  A/B & C!  ", Category: "Flights", Status: "published"})
	if punctuated.Slug != "a-b-c" {
		t.Fatalf("expected punctuation slug, got %q", punctuated.Slug)
	}
	if punctuated.Category != "flights" {
		t.Fatalf("expected punctuation category slug, got %q", punctuated.Category)
	}

	unicode := articleFromInput(ArticleInput{Title: "한글 제목", Slug: "  한글 제목  ", Category: "hotels", Status: "draft"})
	if unicode.Slug != "한글-제목" {
		t.Fatalf("expected unicode slug, got %q", unicode.Slug)
	}

	draft := articleFromInput(ArticleInput{Slug: "draft", Category: "hotels", Status: "draft"})
	if draft.PublishedAt != nil {
		t.Fatal("draft article must not have a publication timestamp")
	}
}

func TestNormalizeSlugHandlesMixedCaseAndWhitespace(t *testing.T) {
	if got := normalizeSlug("  TRAVEL / NEWS  "); got != "travel-news" {
		t.Fatalf("expected normalized travel-news, got %q", got)
	}
	if got := normalizeSlug("_My__Article_"); got != "my-article" {
		t.Fatalf("expected normalized my-article, got %q", got)
	}
}

func TestLocationFilteredArticlesAndCityTags(t *testing.T) {
	previousDB := db
	testDB, err := gorm.Open(sqlite.Open(fmt.Sprintf("%s/test.db", t.TempDir())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db = testDB
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err != nil {
			t.Errorf("failed to get test database connection: %v", err)
		} else if err := sqlDB.Close(); err != nil {
			t.Errorf("failed to close test database connection: %v", err)
		}
		db = previousDB
	})
	if err := db.AutoMigrate(&Article{}, &Category{}, &Country{}, &City{}); err != nil {
		t.Fatal(err)
	}
	category := Category{Name: "항공", Slug: "airline"}
	country := Country{Code: "JP", NameKo: "일본", NameEn: "Japan"}
	city := City{ID: "tyo", CountryCode: "JP", NameKo: "도쿄", NameEn: "Tokyo"}
	otherCountry := Country{Code: "FR", NameKo: "프랑스", NameEn: "France"}
	otherCity := City{ID: "par", CountryCode: "FR", NameKo: "파리", NameEn: "Paris"}
	if err := db.Create(&category).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&country).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&city).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&otherCountry).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&otherCity).Error; err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.GET("/api/articles", listArticles(false))
	router.POST("/api/admin/articles", createArticle)
	router.GET("/api/articles/id/:id", getArticleByID)
	router.GET("/api/countries", listCountries)
	router.GET("/api/countries/:code/cities", listCities)

	validBody := strings.Repeat("도쿄 하네다 및 나리타 공항을 연결하는 신규 직항 노선이 대거 증편되어 여행객들의 이동 편의성이 획기적으로 개선됩니다. ", 20) +
		"\n\n![img1](https://example.com/1.jpg)\n![img2](https://example.com/2.jpg)\n![img3](https://example.com/3.jpg)\n![img4](https://example.com/4.jpg)"
	payload := fmt.Sprintf(`{"title":"Tokyo routes","slug":"tokyo-routes","content":%q,"category":"airline","status":"published","cityIds":["tyo","par"]}`, validBody)
	createRequest := httptest.NewRequest(http.MethodPost, "/api/admin/articles", strings.NewReader(payload))
	createRequest.Header.Set("Content-Type", "application/json")
	createResponse := httptest.NewRecorder()
	router.ServeHTTP(createResponse, createRequest)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("expected created article, got %d: %s", createResponse.Code, createResponse.Body.String())
	}
	var created Article
	if err := json.Unmarshal(createResponse.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if len(created.Cities) != 2 {
		t.Fatalf("expected city tag with country, got %#v", created.Cities)
	}

	listRequest := httptest.NewRequest(http.MethodGet, "/api/articles?category=flights&country=jp&city=tyo", nil)
	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, listRequest)
	if listResponse.Code != http.StatusOK {
		t.Fatalf("expected filtered articles, got %d: %s", listResponse.Code, listResponse.Body.String())
	}
	var articles []Article
	if err := json.Unmarshal(listResponse.Body.Bytes(), &articles); err != nil {
		t.Fatal(err)
	}
	if len(articles) != 1 || articles[0].ID != created.ID {
		t.Fatalf("expected location-filtered article %d, got %#v", created.ID, articles)
	}
	mismatchedRequest := httptest.NewRequest(http.MethodGet, "/api/articles?country=JP&city=par", nil)
	mismatchedResponse := httptest.NewRecorder()
	router.ServeHTTP(mismatchedResponse, mismatchedRequest)
	if mismatchedResponse.Code != http.StatusOK {
		t.Fatalf("expected valid empty response for city outside selected country, got %d", mismatchedResponse.Code)
	}
	var mismatchedArticles []Article
	if err := json.Unmarshal(mismatchedResponse.Body.Bytes(), &mismatchedArticles); err != nil {
		t.Fatal(err)
	}
	if len(mismatchedArticles) != 0 {
		t.Fatalf("expected no articles for a city outside the selected country, got %#v", mismatchedArticles)
	}
	countryRequest := httptest.NewRequest(http.MethodGet, "/api/countries/JP/cities", nil)
	countryResponse := httptest.NewRecorder()
	router.ServeHTTP(countryResponse, countryRequest)
	if countryResponse.Code != http.StatusOK || !strings.Contains(countryResponse.Body.String(), `"id":"tyo"`) {
		t.Fatalf("expected Tokyo in country city list, got %d: %s", countryResponse.Code, countryResponse.Body.String())
	}

	detailRequest := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/articles/id/%d?category=airline", created.ID), nil)
	detailResponse := httptest.NewRecorder()
	router.ServeHTTP(detailResponse, detailRequest)
	if detailResponse.Code != http.StatusOK {
		t.Fatalf("expected article detail, got %d: %s", detailResponse.Code, detailResponse.Body.String())
	}

	invalidPayload := `{"title":"Missing city","slug":"missing-city","category":"airline","status":"published","cityIds":["unknown"]}`
	invalidRequest := httptest.NewRequest(http.MethodPost, "/api/admin/articles", strings.NewReader(invalidPayload))
	invalidRequest.Header.Set("Content-Type", "application/json")
	invalidResponse := httptest.NewRecorder()
	router.ServeHTTP(invalidResponse, invalidRequest)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid city to be rejected, got %d: %s", invalidResponse.Code, invalidResponse.Body.String())
	}
}

func TestMigrateCategorySlugsPreservesArticleCategories(t *testing.T) {
	previousDB := db
	testDB, err := gorm.Open(sqlite.Open(fmt.Sprintf("%s/categories.db", t.TempDir())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db = testDB
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err != nil {
			t.Errorf("failed to get test database connection: %v", err)
		} else if err := sqlDB.Close(); err != nil {
			t.Errorf("failed to close test database connection: %v", err)
		}
		db = previousDB
	})
	if err := db.AutoMigrate(&Article{}, &Category{}); err != nil {
		t.Fatal(err)
	}
	categories := []Category{
		{Name: "Flights", Slug: "flights"},
		{Name: "Industry", Slug: "industry"},
		{Name: "주요뉴스", Slug: "major"},
	}
	if err := db.Create(&categories).Error; err != nil {
		t.Fatal(err)
	}
	articles := []Article{
		{Title: "Flight", Slug: "flight", Category: "flights", Status: "published"},
		{Title: "Industry", Slug: "industry", Category: "industry", Status: "published"},
	}
	if err := db.Create(&articles).Error; err != nil {
		t.Fatal(err)
	}
	if err := migrateCategorySlugs(); err != nil {
		t.Fatal(err)
	}
	for index, expected := range []string{"airline", "major"} {
		var article Article
		if err := db.First(&article, articles[index].ID).Error; err != nil {
			t.Fatal(err)
		}
		if article.Category != expected {
			t.Fatalf("expected article category %q, got %q", expected, article.Category)
		}
	}
}

func TestActiveAdPlacementRequiresValidAdSenseIDs(t *testing.T) {
	_, err := adPlacementFromInput(AdPlacementInput{
		ID: "sidebar_rect", Name: "Sidebar", AdClientID: "ca-pub-1234", AdSlotID: "5678", IsActive: true,
	})
	if err != nil {
		t.Fatalf("expected valid active ad placement, got %v", err)
	}
	_, err = adPlacementFromInput(AdPlacementInput{
		ID: "sidebar_rect", Name: "Sidebar", AdClientID: "custom-script", AdSlotID: "5678", IsActive: true,
	})
	if err == nil {
		t.Fatal("expected invalid AdSense client id to be rejected")
	}
}

func TestSeedDataSupportsNewsCategoriesAndCountryCityFilters(t *testing.T) {
	previousDB := db
	testDB, err := gorm.Open(sqlite.Open(fmt.Sprintf("%s/seed.db", t.TempDir())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db = testDB
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err != nil {
			t.Errorf("failed to get test database connection: %v", err)
		} else if err := sqlDB.Close(); err != nil {
			t.Errorf("failed to close test database connection: %v", err)
		}
		db = previousDB
	})
	if err := db.AutoMigrate(&Article{}, &Category{}, &Country{}, &City{}, &AdPlacement{}); err != nil {
		t.Fatal(err)
	}
	if err := migrateCategorySlugs(); err != nil {
		t.Fatal(err)
	}
	for _, seed := range []func() error{seedLocations, seedArticles, seedAdPlacements, seedLocations, seedArticles, seedAdPlacements} {
		if err := seed(); err != nil {
			t.Fatal(err)
		}
	}

	router := gin.New()
	router.GET("/api/articles", listArticles(false))
	request := httptest.NewRequest(http.MethodGet, "/api/articles?category=airline&country=JP&city=tyo", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected seeded location news, got %d: %s", response.Code, response.Body.String())
	}
	var articles []Article
	if err := json.Unmarshal(response.Body.Bytes(), &articles); err != nil {
		t.Fatal(err)
	}
	if len(articles) != 1 || len(articles[0].Cities) != 1 || articles[0].Cities[0].Country.Code != "JP" {
		t.Fatalf("expected one seeded Tokyo-tagged airline article, got %#v", articles)
	}
	var articleCount, countryCount, cityCount, adCount int64
	if err := db.Model(&Article{}).Count(&articleCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&Country{}).Count(&countryCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&City{}).Count(&cityCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&AdPlacement{}).Count(&adCount).Error; err != nil {
		t.Fatal(err)
	}
	if articleCount != 5 || countryCount != 10 || cityCount != 16 || adCount != 11 {
		t.Fatalf("expected repeatable seed counts article/country/city/ad = 5/10/16/11, got %d/%d/%d/%d", articleCount, countryCount, cityCount, adCount)
	}
}

func TestAdminIDValidationAndSingleArticleEndpoint(t *testing.T) {
	previousDB := db
	testDB, err := gorm.Open(sqlite.Open(fmt.Sprintf("%s/test_id.db", t.TempDir())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db = testDB
	defer func() {
		if sqlDB, err := testDB.DB(); err == nil {
			_ = sqlDB.Close()
		}
		db = previousDB
	}()

	if err := db.AutoMigrate(&Article{}, &Category{}, &Country{}, &City{}); err != nil {
		t.Fatal(err)
	}

	cat := Category{Name: "Airline", Slug: "airline"}
	if err := db.Create(&cat).Error; err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC()
	art := Article{
		Title:       "Test Valid Article",
		Slug:        "test-valid-article",
		Category:    "airline",
		Status:      "published",
		PublishedAt: &now,
	}
	if err := db.Create(&art).Error; err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.GET("/api/admin/articles/:id", getAdminArticle)
	router.PUT("/api/admin/articles/:id", updateArticle)
	router.DELETE("/api/admin/articles/:id", deleteArticle)
	router.DELETE("/api/admin/categories/:id", deleteCategory)

	// 1. Invalid IDs return 400 Bad Request
	for _, badID := range []string{"invalid", "0", "-1", "99999999999999999999"} {
		req := httptest.NewRequest(http.MethodGet, "/api/admin/articles/"+badID, nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)
		if resp.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for bad article id %q, got %d", badID, resp.Code)
		}

		delReq := httptest.NewRequest(http.MethodDelete, "/api/admin/articles/"+badID, nil)
		delResp := httptest.NewRecorder()
		router.ServeHTTP(delResp, delReq)
		if delResp.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for delete with bad article id %q, got %d", badID, delResp.Code)
		}

		catReq := httptest.NewRequest(http.MethodDelete, "/api/admin/categories/"+badID, nil)
		catResp := httptest.NewRecorder()
		router.ServeHTTP(catResp, catReq)
		if catResp.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for delete with bad category id %q, got %d", badID, catResp.Code)
		}
	}

	// 2. Valid ID retrieves single article
	validReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/admin/articles/%d", art.ID), nil)
	validResp := httptest.NewRecorder()
	router.ServeHTTP(validResp, validReq)
	if validResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid article id, got %d: %s", validResp.Code, validResp.Body.String())
	}
	var loaded Article
	if err := json.Unmarshal(validResp.Body.Bytes(), &loaded); err != nil {
		t.Fatal(err)
	}
	if loaded.ID != art.ID || loaded.Slug != art.Slug {
		t.Fatalf("loaded article mismatch: %#v", loaded)
	}
}

func TestAdPlacementPreservesUnderscores(t *testing.T) {
	placement, err := adPlacementFromInput(AdPlacementInput{
		ID:         "main_top",
		Name:       "Main Top Leaderboard",
		AdClientID: "ca-pub-1234567890",
		AdSlotID:   "9876543210",
		Format:     "horizontal",
		IsActive:   true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if placement.ID != "main_top" {
		t.Fatalf("expected ID to preserve underscore 'main_top', got %q", placement.ID)
	}

	sidebarPlacement, err := adPlacementFromInput(AdPlacementInput{
		ID:         "sidebar_rect",
		Name:       "Sidebar Rectangle",
		AdClientID: "ca-pub-1234567890",
		AdSlotID:   "9876543211",
		Format:     "rectangle",
		IsActive:   true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sidebarPlacement.ID != "sidebar_rect" {
		t.Fatalf("expected ID to preserve underscore 'sidebar_rect', got %q", sidebarPlacement.ID)
	}
}

func TestArticleValidationTextAndImageBoundaries(t *testing.T) {
	fourImages := `
![img1](https://example.com/img1.jpg)
![img2](https://example.com/img2.jpg)
![img3](https://example.com/img3.jpg)
![img4](https://example.com/img4.jpg)
`

	// 1. Text length boundaries: 799, 800, 2000, 2001 runes
	body799 := strings.Repeat("가", 799) + fourImages
	valid, textLen, _, errs := validateArticleForPublish(body799, "https://example.com/cover.jpg")
	if valid || textLen != 799 || len(errs) == 0 {
		t.Fatalf("expected 799 characters to fail validation, got valid=%v, len=%d, errs=%v", valid, textLen, errs)
	}

	body800 := strings.Repeat("가", 800) + fourImages
	valid, textLen, _, errs = validateArticleForPublish(body800, "https://example.com/cover.jpg")
	if !valid || textLen != 800 || len(errs) != 0 {
		t.Fatalf("expected 800 characters to pass validation, got valid=%v, len=%d, errs=%v", valid, textLen, errs)
	}

	body2000 := strings.Repeat("가", 2000) + fourImages
	valid, textLen, _, errs = validateArticleForPublish(body2000, "https://example.com/cover.jpg")
	if !valid || textLen != 2000 || len(errs) != 0 {
		t.Fatalf("expected 2,000 characters to pass validation, got valid=%v, len=%d, errs=%v", valid, textLen, errs)
	}

	body2001 := strings.Repeat("가", 2001) + fourImages
	valid, textLen, _, errs = validateArticleForPublish(body2001, "https://example.com/cover.jpg")
	if valid || textLen != 2001 || len(errs) == 0 {
		t.Fatalf("expected 2,001 characters to fail validation, got valid=%v, len=%d, errs=%v", valid, textLen, errs)
	}

	// 2. Image count boundaries: 3, 4, 10, 11 images
	validText := strings.Repeat("가", 1000)

	body3Img := validText + "\n![1](https://example.com/1.jpg)\n![2](https://example.com/2.jpg)\n![3](https://example.com/3.jpg)"
	valid, _, imgCount, errs := validateArticleForPublish(body3Img, "https://example.com/cover.jpg")
	if valid || imgCount != 3 || len(errs) == 0 {
		t.Fatalf("expected 3 images to fail validation, got valid=%v, count=%d, errs=%v", valid, imgCount, errs)
	}

	body4Img := validText + fourImages
	valid, _, imgCount, errs = validateArticleForPublish(body4Img, "https://example.com/cover.jpg")
	if !valid || imgCount != 4 || len(errs) != 0 {
		t.Fatalf("expected 4 images to pass validation, got valid=%v, count=%d, errs=%v", valid, imgCount, errs)
	}

	var tenImgs strings.Builder
	tenImgs.WriteString(validText + "\n")
	for i := 1; i <= 10; i++ {
		tenImgs.WriteString(fmt.Sprintf("![img%d](https://example.com/pic%d.jpg)\n", i, i))
	}
	valid, _, imgCount, errs = validateArticleForPublish(tenImgs.String(), "https://example.com/cover.jpg")
	if !valid || imgCount != 10 || len(errs) != 0 {
		t.Fatalf("expected 10 images to pass validation, got valid=%v, count=%d, errs=%v", valid, imgCount, errs)
	}

	var elevenImgs strings.Builder
	elevenImgs.WriteString(validText + "\n")
	for i := 1; i <= 11; i++ {
		elevenImgs.WriteString(fmt.Sprintf("![img%d](https://example.com/pic%d.jpg)\n", i, i))
	}
	valid, _, imgCount, errs = validateArticleForPublish(elevenImgs.String(), "https://example.com/cover.jpg")
	if valid || imgCount != 11 || len(errs) == 0 {
		t.Fatalf("expected 11 images to fail validation, got valid=%v, count=%d, errs=%v", valid, imgCount, errs)
	}

	// 3. Cover image exclusion
	bodyWithCover := validText + fourImages + "\n![cover](https://example.com/cover.jpg)"
	_, _, countWithCover, _ := validateArticleForPublish(bodyWithCover, "https://example.com/cover.jpg")
	if countWithCover != 4 {
		t.Fatalf("expected cover image to be excluded from body count, got count=%d", countWithCover)
	}

	// 4. Duplicate image deduplication
	bodyWithDuplicate := validText + fourImages + "\n![duplicate](https://example.com/img1.jpg)"
	_, _, countWithDup, _ := validateArticleForPublish(bodyWithDuplicate, "https://example.com/cover.jpg")
	if countWithDup != 4 {
		t.Fatalf("expected duplicate image URL to be deduplicated, got count=%d", countWithDup)
	}
}



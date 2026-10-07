package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

	payload := `{"title":"Tokyo routes","slug":"tokyo-routes","category":"airline","status":"published","cityIds":["tyo","par"]}`
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
	if articleCount != 5 || countryCount != 10 || cityCount != 16 || adCount != 4 {
		t.Fatalf("expected repeatable seed counts article/country/city/ad = 5/10/16/4, got %d/%d/%d/%d", articleCount, countryCount, cityCount, adCount)
	}
}

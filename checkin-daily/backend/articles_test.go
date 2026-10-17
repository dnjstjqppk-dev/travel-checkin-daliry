package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func TestPublishedArticlesAreVisibleInPublicNewsEndpoints(t *testing.T) {
	previousDB := db
	testDB, err := gorm.Open(sqlite.Open(fmt.Sprintf("%s/articles.db", t.TempDir())), &gorm.Config{})
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
	if err := db.AutoMigrate(&Article{}, &Category{}, &Country{}, &City{}, &AdPlacement{}, &AdminAccount{}); err != nil {
		t.Fatal(err)
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&AdminAccount{
		Username: "editor", PasswordHash: string(passwordHash), Role: "admin", IsActive: true,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&Category{Name: "항공", Slug: "airline"}).Error; err != nil {
		t.Fatal(err)
	}

	auth := newAdminAuth(authConfig{
		sessionSecret:  []byte(strings.Repeat("s", 32)),
		allowedOrigins: map[string]struct{}{"https://news.example.com": {}},
	})
	token, err := auth.createSession("editor", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	router := newRouter(auth)

	createArticle := func(slug, status string) {
		t.Helper()
		validContent := strings.Repeat("대한항공 방콕 노선 운항 증편 및 글로벌 여행 수요 급증에 따른 항공권 조기 마감 소식입니다. ", 20) +
			"\n\n![img1](https://example.com/1.jpg)\n![img2](https://example.com/2.jpg)\n![img3](https://example.com/3.jpg)\n![img4](https://example.com/4.jpg)"
		contentPayload := "draft body"
		if status == "published" {
			contentPayload = validContent
		}
		payloadMap := map[string]interface{}{
			"title":    fmt.Sprintf("%s article", slug),
			"slug":     slug,
			"summary":  "summary",
			"content":  contentPayload,
			"category": "airline",
			"author":   "editor",
			"status":   status,
			"cityIds":  []string{},
		}
		bodyBytes, err := json.Marshal(payloadMap)
		if err != nil {
			t.Fatal(err)
		}
		request := httptest.NewRequest(http.MethodPost, "/api/admin/articles", strings.NewReader(string(bodyBytes)))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Origin", "https://news.example.com")
		request.AddCookie(&http.Cookie{Name: adminCookieName, Value: token})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusCreated {
			t.Fatalf("expected admin article creation to return 201, got %d: %s", response.Code, response.Body.String())
		}
	}

	// Verify that invalid published article is blocked with 400
	invalidBody := `{"title":"Short article","slug":"short-article","summary":"summary","content":"too short","category":"airline","author":"editor","status":"published","cityIds":[]}`
	invReq := httptest.NewRequest(http.MethodPost, "/api/admin/articles", strings.NewReader(invalidBody))
	invReq.Header.Set("Content-Type", "application/json")
	invReq.Header.Set("Origin", "https://news.example.com")
	invReq.AddCookie(&http.Cookie{Name: adminCookieName, Value: token})
	invResp := httptest.NewRecorder()
	router.ServeHTTP(invResp, invReq)
	if invResp.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid published article to return 400, got %d: %s", invResp.Code, invResp.Body.String())
	}

	createArticle("published-story", "published")
	createArticle("draft-story", "draft")

	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, httptest.NewRequest(http.MethodGet, "/api/articles?category=airline", nil))
	if listResponse.Code != http.StatusOK {
		t.Fatalf("expected public news list to return 200, got %d", listResponse.Code)
	}
	var articles []Article
	if err := json.Unmarshal(listResponse.Body.Bytes(), &articles); err != nil {
		t.Fatal(err)
	}
	if len(articles) != 1 || articles[0].Slug != "published-story" {
		t.Fatalf("expected only published article in the public list, got %#v", articles)
	}

	detailResponse := httptest.NewRecorder()
	router.ServeHTTP(detailResponse, httptest.NewRequest(http.MethodGet, "/api/articles/published-story", nil))
	if detailResponse.Code != http.StatusOK {
		t.Fatalf("expected published article detail to be public, got %d", detailResponse.Code)
	}

	draftResponse := httptest.NewRecorder()
	router.ServeHTTP(draftResponse, httptest.NewRequest(http.MethodGet, "/api/articles/draft-story", nil))
	if draftResponse.Code != http.StatusNotFound {
		t.Fatalf("expected draft article detail to remain private, got %d", draftResponse.Code)
	}
}

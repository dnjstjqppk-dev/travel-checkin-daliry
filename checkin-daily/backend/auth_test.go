package main

import (
	"encoding/base64"
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

func TestAdminAPIRequiresAuthenticatedAdminAndSameOriginWrites(t *testing.T) {
	previousDB := db
	testDB, err := gorm.Open(sqlite.Open(fmt.Sprintf("%s/auth.db", t.TempDir())), &gorm.Config{})
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
	password := "test-admin-password"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	auth := newAdminAuth(authConfig{
		username:       "editor@example.com",
		passwordHash:   hash,
		sessionSecret:  []byte(strings.Repeat("s", 32)),
		allowedOrigins: map[string]struct{}{"https://news.example.com": {}},
	})
	router := newRouter(auth)

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/admin/articles", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated admin request to be denied, got %d", unauthorized.Code)
	}

	loginRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(
		`{"username":"editor@example.com","password":"test-admin-password"}`,
	))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginRequest.Header.Set("Origin", "https://news.example.com")
	loginResponse := httptest.NewRecorder()
	router.ServeHTTP(loginResponse, loginRequest)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("expected successful login, got %d: %s", loginResponse.Code, loginResponse.Body.String())
	}
	var sessionCookie *http.Cookie
	for _, cookie := range loginResponse.Result().Cookies() {
		if cookie.Name == adminCookieName {
			sessionCookie = cookie
		}
	}
	if sessionCookie == nil {
		t.Fatal("successful login must issue an admin session cookie")
	}
	if !sessionCookie.HttpOnly || sessionCookie.SameSite != http.SameSiteStrictMode || sessionCookie.Path != "/" {
		t.Fatalf("session cookie is missing secure browser attributes: %#v", sessionCookie)
	}
	if sessionCookie.Secure {
		t.Fatal("secure attribute should follow the test's explicitly insecure local cookie config")
	}

	sessionRequest := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	sessionRequest.AddCookie(sessionCookie)
	sessionResponse := httptest.NewRecorder()
	router.ServeHTTP(sessionResponse, sessionRequest)
	if sessionResponse.Code != http.StatusOK || !strings.Contains(sessionResponse.Body.String(), `"role":"admin"`) {
		t.Fatalf("expected authenticated admin session, got %d: %s", sessionResponse.Code, sessionResponse.Body.String())
	}

	crossSiteWrite := httptest.NewRequest(http.MethodPost, "/api/admin/countries", strings.NewReader(
		`{"code":"JP","nameKo":"일본","nameEn":"Japan"}`,
	))
	crossSiteWrite.Header.Set("Content-Type", "application/json")
	crossSiteWrite.Header.Set("Origin", "https://attacker.example")
	crossSiteWrite.AddCookie(sessionCookie)
	crossSiteResponse := httptest.NewRecorder()
	router.ServeHTTP(crossSiteResponse, crossSiteWrite)
	if crossSiteResponse.Code != http.StatusForbidden {
		t.Fatalf("expected disallowed origin to be rejected, got %d", crossSiteResponse.Code)
	}

	missingOriginWrite := httptest.NewRequest(http.MethodPost, "/api/admin/countries", strings.NewReader(
		`{"code":"JP","nameKo":"일본","nameEn":"Japan"}`,
	))
	missingOriginWrite.Header.Set("Content-Type", "application/json")
	missingOriginWrite.AddCookie(sessionCookie)
	missingOriginResponse := httptest.NewRecorder()
	router.ServeHTTP(missingOriginResponse, missingOriginWrite)
	if missingOriginResponse.Code != http.StatusForbidden {
		t.Fatalf("expected missing origin to be rejected for state-changing admin request, got %d", missingOriginResponse.Code)
	}

	allowedWrite := httptest.NewRequest(http.MethodPost, "/api/admin/countries", strings.NewReader(
		`{"code":"JP","nameKo":"일본","nameEn":"Japan"}`,
	))
	allowedWrite.Header.Set("Content-Type", "application/json")
	allowedWrite.Header.Set("Origin", "https://news.example.com")
	allowedWrite.AddCookie(sessionCookie)
	allowedWriteResponse := httptest.NewRecorder()
	router.ServeHTTP(allowedWriteResponse, allowedWrite)
	if allowedWriteResponse.Code != http.StatusCreated {
		t.Fatalf("expected authenticated same-origin admin write, got %d: %s", allowedWriteResponse.Code, allowedWriteResponse.Body.String())
	}
}

func TestAdminSessionRejectsTamperingExpiryAndRoleEscalation(t *testing.T) {
	auth := newAdminAuth(authConfig{
		username:       "editor",
		sessionSecret:  []byte(strings.Repeat("s", 32)),
		allowedOrigins: map[string]struct{}{"https://news.example.com": {}},
	})
	token, err := auth.createSession("editor", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := auth.parseSession(token+"x", time.Now()); err == nil {
		t.Fatal("expected modified signature to be rejected")
	}
	expired, err := auth.createSession("editor", time.Now().Add(-adminSessionTTL-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := auth.parseSession(expired, time.Now()); err == nil {
		t.Fatal("expected expired session to be rejected")
	}

	payload := sessionClaims{
		Username:  "editor",
		Role:      "user",
		ExpiresAt: time.Now().Add(time.Hour).Unix(),
		Nonce:     "nonce",
	}
	serialized, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	encoded := base64RawURL(serialized)
	forged := encoded + "." + base64RawURL(auth.sign(encoded))
	if _, err := auth.parseSession(forged, time.Now()); err == nil {
		t.Fatal("expected non-admin role to be rejected")
	}
}

func TestLoginAttemptsAreRateLimitedAndExpire(t *testing.T) {
	auth := newAdminAuth(authConfig{})
	start := time.Now()
	for i := 0; i < loginMaxAttempts; i++ {
		auth.recordFailedLogin("127.0.0.1", start)
	}
	if !auth.loginBlocked("127.0.0.1", start) {
		t.Fatal("expected repeated failures to block further login attempts")
	}
	if auth.loginBlocked("127.0.0.1", start.Add(loginWindow+time.Second)) {
		t.Fatal("expected login block to expire")
	}
}

func TestLoadAuthConfigFailsClosedAndRequiresStrongSettings(t *testing.T) {
	t.Setenv("ADMIN_USERNAME", "")
	t.Setenv("ADMIN_PASSWORD_HASH", "")
	t.Setenv("SESSION_SECRET", "")
	if _, err := loadAuthConfig(); err == nil {
		t.Fatal("expected missing admin configuration to fail closed")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("ADMIN_USERNAME", "editor")
	t.Setenv("ADMIN_PASSWORD_HASH", string(hash))
	t.Setenv("SESSION_SECRET", strings.Repeat("s", 32))
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://news.example.com/path")
	if _, err := loadAuthConfig(); err == nil {
		t.Fatal("expected path-bearing CORS origin to be rejected")
	}

	t.Setenv("CORS_ALLOWED_ORIGINS", "https://news.example.com")
	if _, err := loadAuthConfig(); err == nil {
		t.Fatal("expected a bcrypt hash below the configured minimum cost to be rejected")
	}

	hash, err = bcrypt.GenerateFromPassword([]byte("test-admin-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("ADMIN_PASSWORD_HASH", string(hash))
	config, err := loadAuthConfig()
	if err != nil {
		t.Fatal(err)
	}
	if !config.cookieSecure {
		t.Fatal("secure cookies must be the default")
	}
	if _, ok := config.allowedOrigins["https://news.example.com"]; !ok {
		t.Fatal("expected configured exact origin to be allowed")
	}
}

func base64RawURL(value []byte) string {
	return base64.RawURLEncoding.EncodeToString(value)
}

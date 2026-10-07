package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	adminCookieName  = "checkin_admin_session"
	adminSessionTTL  = 8 * time.Hour
	loginWindow      = 15 * time.Minute
	loginMaxAttempts = 5
)

type authConfig struct {
	username       string
	passwordHash   []byte
	sessionSecret  []byte
	cookieSecure   bool
	allowedOrigins map[string]struct{}
}

type sessionClaims struct {
	Username  string `json:"sub"`
	Role      string `json:"role"`
	ExpiresAt int64  `json:"exp"`
	Nonce     string `json:"nonce"`
}

type loginAttempt struct {
	count     int
	expiresAt time.Time
}

type adminAuth struct {
	config   authConfig
	mu       sync.Mutex
	attempts map[string]loginAttempt
}

type loginInput struct {
	Username string `json:"username" binding:"required,max=254"`
	Password string `json:"password" binding:"required,max=1024"`
}

func loadAuthConfig() (authConfig, error) {
	username := strings.TrimSpace(os.Getenv("ADMIN_USERNAME"))
	passwordHash := strings.TrimSpace(os.Getenv("ADMIN_PASSWORD_HASH"))
	sessionSecret := os.Getenv("SESSION_SECRET")
	if username == "" || passwordHash == "" || sessionSecret == "" {
		return authConfig{}, errors.New("ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and SESSION_SECRET must be configured")
	}
	if len(sessionSecret) < 32 {
		return authConfig{}, errors.New("SESSION_SECRET must be at least 32 bytes")
	}
	cost, err := bcrypt.Cost([]byte(passwordHash))
	if err != nil || cost < bcrypt.DefaultCost {
		return authConfig{}, errors.New("ADMIN_PASSWORD_HASH must be a valid bcrypt hash")
	}
	cookieSecure := true
	if value, ok := os.LookupEnv("COOKIE_SECURE"); ok {
		parsed, err := strconv.ParseBool(value)
		if err != nil {
			return authConfig{}, errors.New("COOKIE_SECURE must be true or false")
		}
		cookieSecure = parsed
	}
	origins := make(map[string]struct{})
	configuredOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if configuredOrigins == "" {
		configuredOrigins = "http://localhost:3000"
	}
	for _, origin := range strings.Split(configuredOrigins, ",") {
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		if origin == "" {
			continue
		}
		parsed, err := url.Parse(origin)
		if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") ||
			parsed.Host == "" || parsed.User != nil || parsed.Path != "" ||
			parsed.RawQuery != "" || parsed.Fragment != "" {
			return authConfig{}, errors.New("CORS_ALLOWED_ORIGINS must contain only HTTP(S) origins")
		}
		origins[origin] = struct{}{}
	}
	if len(origins) == 0 {
		return authConfig{}, errors.New("CORS_ALLOWED_ORIGINS must contain at least one origin")
	}
	return authConfig{
		username:       username,
		passwordHash:   []byte(passwordHash),
		sessionSecret:  []byte(sessionSecret),
		cookieSecure:   cookieSecure,
		allowedOrigins: origins,
	}, nil
}

func newAdminAuth(config authConfig) *adminAuth {
	return &adminAuth{config: config, attempts: make(map[string]loginAttempt)}
}

func (auth *adminAuth) login(c *gin.Context) {
	if !auth.hasAllowedOrigin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "request origin is not allowed"})
		return
	}
	if strings.EqualFold(c.GetHeader("Sec-Fetch-Site"), "cross-site") {
		c.JSON(http.StatusForbidden, gin.H{"error": "cross-site request rejected"})
		return
	}
	clientIP := requestClientIP(c.Request)
	if auth.loginBlocked(clientIP, time.Now()) {
		c.Header("Retry-After", strconv.Itoa(int(loginWindow.Seconds())))
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many login attempts; try again later"})
		return
	}
	var input loginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
		return
	}
	usernameMatches := subtle.ConstantTimeCompare([]byte(input.Username), []byte(auth.config.username)) == 1
	passwordMatches := bcrypt.CompareHashAndPassword(auth.config.passwordHash, []byte(input.Password)) == nil
	if !usernameMatches || !passwordMatches {
		auth.recordFailedLogin(clientIP, time.Now())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}
	auth.clearLoginAttempts(clientIP)
	token, err := auth.createSession(auth.config.username, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create an admin session"})
		return
	}
	http.SetCookie(c.Writer, auth.sessionCookie(token, int(adminSessionTTL.Seconds())))
	c.JSON(http.StatusOK, gin.H{"username": auth.config.username, "role": "admin", "expiresIn": int(adminSessionTTL.Seconds())})
}

func (auth *adminAuth) requireAdmin(c *gin.Context) {
	cookie, err := c.Request.Cookie(adminCookieName)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	claims, err := auth.parseSession(cookie.Value, time.Now())
	if err != nil || claims.Role != "admin" ||
		subtle.ConstantTimeCompare([]byte(claims.Username), []byte(auth.config.username)) != 1 {
		http.SetCookie(c.Writer, auth.sessionCookie("", -1))
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	c.Set("admin_username", claims.Username)
	c.Set("admin_role", claims.Role)
	c.Next()
}

func (auth *adminAuth) requireSameOrigin(c *gin.Context) {
	if !auth.hasAllowedOrigin(c) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "request origin is not allowed"})
		return
	}
	if strings.EqualFold(c.GetHeader("Sec-Fetch-Site"), "cross-site") {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "cross-site request rejected"})
		return
	}
	c.Next()
}

func (auth *adminAuth) session(c *gin.Context) {
	username, _ := c.Get("admin_username")
	role, _ := c.Get("admin_role")
	c.JSON(http.StatusOK, gin.H{"username": username, "role": role, "expiresIn": int(adminSessionTTL.Seconds())})
}

func (auth *adminAuth) logout(c *gin.Context) {
	http.SetCookie(c.Writer, auth.sessionCookie("", -1))
	c.Status(http.StatusNoContent)
}

func (auth *adminAuth) hasAllowedOrigin(c *gin.Context) bool {
	origin := strings.TrimRight(strings.TrimSpace(c.GetHeader("Origin")), "/")
	if origin == "" {
		return false
	}
	_, ok := auth.config.allowedOrigins[origin]
	return ok
}

func (auth *adminAuth) createSession(username string, now time.Time) (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	payload, err := json.Marshal(sessionClaims{
		Username:  username,
		Role:      "admin",
		ExpiresAt: now.Add(adminSessionTTL).Unix(),
		Nonce:     base64.RawURLEncoding.EncodeToString(nonce),
	})
	if err != nil {
		return "", err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signature := auth.sign(encodedPayload)
	return encodedPayload + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func (auth *adminAuth) parseSession(token string, now time.Time) (sessionClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return sessionClaims{}, errors.New("invalid session token")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(signature, auth.sign(parts[0])) {
		return sessionClaims{}, errors.New("invalid session signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return sessionClaims{}, errors.New("invalid session payload")
	}
	var claims sessionClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return sessionClaims{}, errors.New("invalid session claims")
	}
	if claims.Username == "" || claims.Role != "admin" || claims.Nonce == "" ||
		claims.ExpiresAt <= now.Unix() || claims.ExpiresAt > now.Add(adminSessionTTL).Unix()+1 {
		return sessionClaims{}, errors.New("expired or invalid session")
	}
	return claims, nil
}

func (auth *adminAuth) sign(payload string) []byte {
	mac := hmac.New(sha256.New, auth.config.sessionSecret)
	_, _ = mac.Write([]byte(payload))
	return mac.Sum(nil)
}

func (auth *adminAuth) sessionCookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name: adminCookieName, Value: value, Path: "/", MaxAge: maxAge,
		HttpOnly: true, Secure: auth.config.cookieSecure, SameSite: http.SameSiteStrictMode,
	}
}

func (auth *adminAuth) loginBlocked(ip string, now time.Time) bool {
	auth.mu.Lock()
	defer auth.mu.Unlock()
	attempt, ok := auth.attempts[ip]
	if !ok {
		return false
	}
	if !now.Before(attempt.expiresAt) {
		delete(auth.attempts, ip)
		return false
	}
	return attempt.count >= loginMaxAttempts
}

func (auth *adminAuth) recordFailedLogin(ip string, now time.Time) {
	auth.mu.Lock()
	defer auth.mu.Unlock()
	for key, attempt := range auth.attempts {
		if !now.Before(attempt.expiresAt) {
			delete(auth.attempts, key)
		}
	}
	if _, exists := auth.attempts[ip]; !exists && len(auth.attempts) >= 10_000 {
		return
	}
	attempt := auth.attempts[ip]
	if !now.Before(attempt.expiresAt) {
		attempt = loginAttempt{expiresAt: now.Add(loginWindow)}
	}
	attempt.count++
	auth.attempts[ip] = attempt
}

func (auth *adminAuth) clearLoginAttempts(ip string) {
	auth.mu.Lock()
	delete(auth.attempts, ip)
	auth.mu.Unlock()
}

func requestClientIP(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		return request.RemoteAddr
	}
	return host
}

func securityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Cache-Control", "no-store")
		c.Next()
	}
}

package main

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type adminAccount struct {
	ID           uint   `gorm:"primaryKey"`
	Username     string `gorm:"uniqueIndex;size:254;not null"`
	PasswordHash string `gorm:"size:100;not null"`
	Role         string `gorm:"size:20;not null;default:admin"`
	IsActive     bool   `gorm:"not null;default:true"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (adminAccount) TableName() string { return "admin_accounts" }

func main() {
	databasePath := os.Getenv("SQLITE_PATH")
	if databasePath == "" {
		databasePath = "checkin-daily.db"
	}
	username := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_USERNAME")))
	if username == "" {
		username = "admin"
	}
	if len(username) > 254 {
		log.Fatal("ADMIN_USERNAME must be at most 254 characters")
	}
	database, err := gorm.Open(sqlite.Open(databasePath), &gorm.Config{})
	if err != nil {
		log.Fatalf("could not open SQLite database: %v", err)
	}
	password, err := createAdminAccount(database, username)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Admin account created in %s\nUsername: %s\nTemporary password: %s\nStore this password now; it cannot be retrieved later.\n", databasePath, username, password)
}

func createAdminAccount(database *gorm.DB, username string) (string, error) {
	if err := database.AutoMigrate(&adminAccount{}); err != nil {
		return "", fmt.Errorf("admin account table could not be created: %w", err)
	}
	var count int64
	if err := database.Model(&adminAccount{}).Count(&count).Error; err != nil {
		return "", fmt.Errorf("existing admin accounts could not be checked: %w", err)
	}
	if count != 0 {
		return "", errors.New("an admin account already exists; refusing to create another bootstrap credential")
	}
	randomBytes := make([]byte, 24)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("temporary password could not be generated: %w", err)
	}
	password := base64.RawURLEncoding.EncodeToString(randomBytes)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("temporary password could not be hashed: %w", err)
	}
	account := adminAccount{
		Username: username, PasswordHash: string(hash), Role: "admin", IsActive: true,
	}
	if err := database.Create(&account).Error; err != nil {
		return "", fmt.Errorf("admin account could not be created: %w", err)
	}
	return password, nil
}

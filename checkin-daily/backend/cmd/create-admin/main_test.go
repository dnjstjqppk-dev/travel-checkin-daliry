package main

import (
	"testing"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func TestCreateAdminAccountStoresOnlyBcryptHashAndRefusesDuplicates(t *testing.T) {
	database, err := gorm.Open(sqlite.Open(t.TempDir()+"/admin.db"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := database.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Errorf("failed to close test database: %v", err)
		}
	})
	password, err := createAdminAccount(database, "admin")
	if err != nil {
		t.Fatal(err)
	}
	var account adminAccount
	if err := database.First(&account, "username = ?", "admin").Error; err != nil {
		t.Fatal(err)
	}
	if account.PasswordHash == password {
		t.Fatal("plaintext password must not be stored")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(account.PasswordHash), []byte(password)); err != nil {
		t.Fatalf("stored password hash did not verify: %v", err)
	}
	if _, err := createAdminAccount(database, "second-admin"); err == nil {
		t.Fatal("expected duplicate bootstrap account creation to be refused")
	}
}

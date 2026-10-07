package main

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

func main() {
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		fmt.Fprintln(os.Stderr, "run this command in an interactive terminal")
		os.Exit(1)
	}
	fmt.Fprint(os.Stderr, "Admin password: ")
	password, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		fmt.Fprintln(os.Stderr, "could not read password")
		os.Exit(1)
	}
	defer func() {
		for i := range password {
			password[i] = 0
		}
	}()
	if len(password) < 12 || len(password) > 72 {
		fmt.Fprintln(os.Stderr, "password must be between 12 and 72 bytes")
		os.Exit(1)
	}
	hash, err := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "could not hash password")
		os.Exit(1)
	}
	fmt.Println(string(hash))
}

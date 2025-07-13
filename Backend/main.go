// main.go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func main() {
	// Database connection from environment variables
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_PORT"),
		os.Getenv("POSTGRES_DB"))

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to ping database:", err)
	}
	fmt.Println("Successfully connected to the database!")

	if err := createTables(); err != nil {
		log.Fatal("Failed to create tables:", err)
	}

	if err := createAdminUser(); err != nil {
		log.Fatal("Failed to create admin user:", err)
	}

	// Router
	r := mux.NewRouter()

	// --- User Routes ---
	r.HandleFunc("/register", RegisterUser).Methods("POST")
	r.HandleFunc("/login", LoginUser).Methods("POST")
	r.HandleFunc("/users", GetAllUsers).Methods("GET")
	r.HandleFunc("/users/{id}", UpdateUser).Methods("PUT")
	r.HandleFunc("/users/{id}", DeleteUser).Methods("DELETE")

	// --- Category Routes ---
	r.HandleFunc("/categories", CreateCategory).Methods("POST")
	r.HandleFunc("/categories/{user_id}", GetCategories).Methods("GET")
	r.HandleFunc("/categories/{id}", UpdateCategory).Methods("PUT")
	r.HandleFunc("/categories/{id}", DeleteCategory).Methods("DELETE")

	// --- Transaction Routes ---
	r.HandleFunc("/transactions", CreateTransaction).Methods("POST")
	r.HandleFunc("/transactions/{user_id}", GetTransactions).Methods("GET")
	r.HandleFunc("/transactions/{id}", UpdateTransaction).Methods("PUT")
	r.HandleFunc("/transactions/{id}", DeleteTransaction).Methods("DELETE")

	// --- Budget Routes ---
	r.HandleFunc("/budgets", CreateBudget).Methods("POST")
	r.HandleFunc("/budgets/{user_id}", GetBudgets).Methods("GET")
	r.HandleFunc("/budgets/{id}", UpdateBudget).Methods("PUT")
	r.HandleFunc("/budgets/{id}", DeleteBudget).Methods("DELETE")

	// --- Sharing Routes ---
	r.HandleFunc("/budgets/share", ShareBudget).Methods("POST")
	r.HandleFunc("/budgets/shared/{user_id}", GetSharedBudgets).Methods("GET")
	r.HandleFunc("/budgets/share/{id}", DeleteSharedBudget).Methods("DELETE") // To unshare

	// CORS Configuration
	allowedOrigin := os.Getenv("CORS_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:5173" // Default for local development
	}

	allowedOrigins := handlers.AllowedOrigins([]string{allowedOrigin})
	allowedMethods := handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	allowedHeaders := handlers.AllowedHeaders([]string{"X-Requested-With", "Content-Type", "Authorization"})

	log.Printf("Budgello server starting on :8080, allowing origin: %s", allowedOrigin)
	log.Fatal(http.ListenAndServe(":8080", handlers.CORS(allowedOrigins, allowedMethods, allowedHeaders)(r)))
}

func createAdminUser() error {
	adminUsername := os.Getenv("ADMIN_USERNAME")
	adminPassword := os.Getenv("ADMIN_PASSWORD")

	// Check if admin user already exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username=$1)", adminUsername).Scan(&exists)
	if err != nil {
		return err
	}

	if !exists {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), 8)
		if err != nil {
			return err
		}

		_, err = db.Exec("INSERT INTO users (username, password, role) VALUES ($1, $2, 'admin')", adminUsername, string(hashedPassword))
		if err != nil {
			return err
		}
		log.Println("Admin user created successfully.")
	} else {
		log.Println("Admin user already exists.")
	}

	return nil
}

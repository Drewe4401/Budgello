// main.go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

var db *sql.DB

func main() {
	// Database connection
	var err error
	connStr := "postgres://postgres:postgres@localhost:5432/budgello_db?sslmode=disable"
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

	if err := seedDatabase(); err != nil {
		log.Fatal("Failed to seed database:", err)
	}

	// Router
	r := mux.NewRouter()

	// --- User Routes ---
	r.HandleFunc("/register", RegisterUser).Methods("POST")
	r.HandleFunc("/login", LoginUser).Methods("POST")
	r.HandleFunc("/users", GetAllUsers).Methods("GET")        // Typically admin-only
	r.HandleFunc("/users/{id}", UpdateUser).Methods("PUT")    // Typically admin or self
	r.HandleFunc("/users/{id}", DeleteUser).Methods("DELETE") // Typically admin or self

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
	allowedOrigins := handlers.AllowedOrigins([]string{"http://localhost:5173"})
	allowedMethods := handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	allowedHeaders := handlers.AllowedHeaders([]string{"X-Requested-With", "Content-Type", "Authorization"})

	log.Println("Budgello server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", handlers.CORS(allowedOrigins, allowedMethods, allowedHeaders)(r)))
}

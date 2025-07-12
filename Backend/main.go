// main.go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/handlers" // Import the handlers package
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

	// API Routes
	r.HandleFunc("/register", RegisterUser).Methods("POST")
	r.HandleFunc("/login", LoginUser).Methods("POST")
	r.HandleFunc("/transactions", CreateTransaction).Methods("POST")
	r.HandleFunc("/transactions/{user_id}", GetTransactions).Methods("GET")
	r.HandleFunc("/budgets", CreateBudget).Methods("POST")
	r.HandleFunc("/budgets/{user_id}", GetBudgets).Methods("GET")
	r.HandleFunc("/budgets/share", ShareBudget).Methods("POST")
	r.HandleFunc("/budgets/shared/{user_id}", GetSharedBudgets).Methods("GET")
	adminRoutes := r.PathPrefix("/admin").Subrouter()
	adminRoutes.HandleFunc("/users", GetAllUsers).Methods("GET")

	// --- CORS Configuration ---
	// This tells the backend to accept requests from your frontend's origin.
	allowedOrigins := handlers.AllowedOrigins([]string{"http://localhost:5173"})
	allowedMethods := handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	allowedHeaders := handlers.AllowedHeaders([]string{"X-Requested-With", "Content-Type", "Authorization"})

	log.Println("Budgello server starting on :8080")
	// Wrap the router with the CORS middleware
	log.Fatal(http.ListenAndServe(":8080", handlers.CORS(allowedOrigins, allowedMethods, allowedHeaders)(r)))
}

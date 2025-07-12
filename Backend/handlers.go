// handlers.go
package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
)

// Models
type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"` // Omit password from responses
	Role     string `json:"role,omitempty"`
}

type Transaction struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	Date        time.Time `json:"date"`
	CategoryID  int       `json:"category_id"`
}

type Budget struct {
	ID         int     `json:"id"`
	UserID     int     `json:"user_id"`
	CategoryID int     `json:"category_id"`
	Amount     float64 `json:"amount"`
	Month      int     `json:"month"`
	Year       int     `json:"year"`
}

type SharedBudget struct {
	ID         int `json:"id"`
	BudgetID   int `json:"budget_id"`
	FromUserID int `json:"from_user_id"`
	ToUserID   int `json:"to_user_id"`
}

// User Handlers
func RegisterUser(w http.ResponseWriter, r *http.Request) {
	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), 8)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// The 'role' column has a default value of 'user', so we don't need to specify it here.
	_, err = db.Exec("INSERT INTO users (username, password) VALUES ($1, $2)", user.Username, string(hashedPassword))
	if err != nil {
		http.Error(w, "Failed to register user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "User registered successfully"})
}

func LoginUser(w http.ResponseWriter, r *http.Request) {
	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var storedUser User
	// Retrieve the role along with other details
	row := db.QueryRow("SELECT id, password, role FROM users WHERE username=$1", user.Username)
	if err := row.Scan(&storedUser.ID, &storedUser.Password, &storedUser.Role); err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedUser.Password), []byte(user.Password)); err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	// In a real app, you would issue a token (e.g., JWT) here that includes the user's role.
	// The frontend would then use this role to determine what to display.
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login successful",
		"user_id": storedUser.ID,
		"role":    storedUser.Role, // Return the role in the response
	})
}

// Transaction Handlers
func CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var t Transaction
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := db.Exec("INSERT INTO transactions (user_id, description, amount, date, category_id) VALUES ($1, $2, $3, $4, $5)",
		t.UserID, t.Description, t.Amount, time.Now(), t.CategoryID)
	if err != nil {
		http.Error(w, "Failed to create transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func GetTransactions(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	rows, err := db.Query("SELECT id, user_id, description, amount, date, category_id FROM transactions WHERE user_id=$1", userID)
	if err != nil {
		http.Error(w, "Failed to retrieve transactions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var transactions []Transaction
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.ID, &t.UserID, &t.Description, &t.Amount, &t.Date, &t.CategoryID); err != nil {
			http.Error(w, "Failed to scan transaction", http.StatusInternalServerError)
			return
		}
		transactions = append(transactions, t)
	}

	json.NewEncoder(w).Encode(transactions)
}

// Budget Handlers
func CreateBudget(w http.ResponseWriter, r *http.Request) {
	var b Budget
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := db.Exec("INSERT INTO budgets (user_id, category_id, amount, month, year) VALUES ($1, $2, $3, $4, $5)",
		b.UserID, b.CategoryID, b.Amount, b.Month, b.Year)
	if err != nil {
		http.Error(w, "Failed to create budget", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(b)
}

func GetBudgets(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	rows, err := db.Query("SELECT id, user_id, category_id, amount, month, year FROM budgets WHERE user_id=$1", userID)
	if err != nil {
		http.Error(w, "Failed to retrieve budgets", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var budgets []Budget
	for rows.Next() {
		var b Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.CategoryID, &b.Amount, &b.Month, &b.Year); err != nil {
			http.Error(w, "Failed to scan budget", http.StatusInternalServerError)
			return
		}
		budgets = append(budgets, b)
	}

	json.NewEncoder(w).Encode(budgets)
}

// Sharing Handlers
func ShareBudget(w http.ResponseWriter, r *http.Request) {
	var sb SharedBudget
	if err := json.NewDecoder(r.Body).Decode(&sb); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check if the budget belongs to the user sharing it
	var ownerID int
	err := db.QueryRow("SELECT user_id FROM budgets WHERE id = $1", sb.BudgetID).Scan(&ownerID)
	if err != nil {
		http.Error(w, "Budget not found", http.StatusNotFound)
		return
	}
	if ownerID != sb.FromUserID {
		http.Error(w, "You can only share your own budgets", http.StatusForbidden)
		return
	}

	_, err = db.Exec("INSERT INTO shared_budgets (budget_id, from_user_id, to_user_id) VALUES ($1, $2, $3)",
		sb.BudgetID, sb.FromUserID, sb.ToUserID)
	if err != nil {
		http.Error(w, "Failed to share budget", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Budget shared successfully"})
}

func GetSharedBudgets(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	query := `
        SELECT b.id, b.user_id, b.category_id, b.amount, b.month, b.year
        FROM budgets b
        JOIN shared_budgets sb ON b.id = sb.budget_id
        WHERE sb.to_user_id = $1
    `
	rows, err := db.Query(query, userID)
	if err != nil {
		http.Error(w, "Failed to retrieve shared budgets", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var budgets []Budget
	for rows.Next() {
		var b Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.CategoryID, &b.Amount, &b.Month, &b.Year); err != nil {
			http.Error(w, "Failed to scan shared budget", http.StatusInternalServerError)
			return
		}
		budgets = append(budgets, b)
	}

	json.NewEncoder(w).Encode(budgets)
}

// --- Admin Handlers ---

// GetAllUsers is an example of an admin-only endpoint.
// In a real application, this would be protected by middleware that validates an admin token (e.g., a JWT).
// The middleware would parse the token, confirm the user's 'admin' role, and then allow the request to proceed.
func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, username, role FROM users")
	if err != nil {
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role); err != nil {
			http.Error(w, "Failed to scan user", http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}

	json.NewEncoder(w).Encode(users)
}

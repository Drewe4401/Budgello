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

// --- MODELS ---
type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
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

// Category struct (New)
type Category struct {
	ID     int    `json:"id"`
	UserID int    `json:"user_id"`
	Name   string `json:"name"`
}

// Budget struct updated to new schema
type Budget struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Period    time.Time `json:"period"`
	Frequency string    `json:"frequency"` // "weekly", "monthly", "yearly"
	Amount    float64   `json:"amount"`
}

type SharedBudget struct {
	ID         int `json:"id"`
	BudgetID   int `json:"budget_id"`
	FromUserID int `json:"from_user_id"`
	ToUserID   int `json:"to_user_id"`
}

// --- USER HANDLERS (Unchanged) ---
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
	row := db.QueryRow("SELECT id, password, role FROM users WHERE username=$1", user.Username)
	if err := row.Scan(&storedUser.ID, &storedUser.Password, &storedUser.Role); err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(storedUser.Password), []byte(user.Password)); err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"message": "Login successful", "user_id": storedUser.ID, "role": storedUser.Role})
}

// --- CATEGORY HANDLERS (New) ---
func CreateCategory(w http.ResponseWriter, r *http.Request) {
	var c Category
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	// Insert the new category and return the ID
	err := db.QueryRow("INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id",
		c.UserID, c.Name).Scan(&c.ID)
	if err != nil {
		http.Error(w, "Failed to create category. It may already exist for this user.", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func GetCategories(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	rows, err := db.Query("SELECT id, user_id, name FROM categories WHERE user_id=$1", userID)
	if err != nil {
		http.Error(w, "Failed to retrieve categories", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name); err != nil {
			http.Error(w, "Failed to scan category", http.StatusInternalServerError)
			return
		}
		categories = append(categories, c)
	}
	json.NewEncoder(w).Encode(categories)
}

// --- TRANSACTION HANDLERS (Unchanged) ---
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

// --- BUDGET HANDLERS (Updated) ---
func CreateBudget(w http.ResponseWriter, r *http.Request) {
	var b Budget
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	_, err := db.Exec("INSERT INTO budgets (user_id, period, frequency, amount) VALUES ($1, $2, $3, $4)",
		b.UserID, b.Period, b.Frequency, b.Amount)
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
	rows, err := db.Query("SELECT id, user_id, period, frequency, amount FROM budgets WHERE user_id=$1", userID)
	if err != nil {
		http.Error(w, "Failed to retrieve budgets", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var budgets []Budget
	for rows.Next() {
		var b Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.Period, &b.Frequency, &b.Amount); err != nil {
			http.Error(w, "Failed to scan budget", http.StatusInternalServerError)
			return
		}
		budgets = append(budgets, b)
	}
	json.NewEncoder(w).Encode(budgets)
}
func UpdateBudget(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	budgetID, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid budget ID", http.StatusBadRequest)
		return
	}

	var b Budget
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = db.Exec("UPDATE budgets SET period=$1, frequency=$2, amount=$3 WHERE id=$4",
		b.Period, b.Frequency, b.Amount, budgetID)
	if err != nil {
		http.Error(w, "Failed to update budget", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(b)
}
func DeleteBudget(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	budgetID, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid budget ID", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("DELETE FROM budgets WHERE id=$1", budgetID)
	if err != nil {
		http.Error(w, "Failed to delete budget", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Budget deleted successfully"})
}

// --- ADMIN & SHARING HANDLERS (Unchanged) ---
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
func ShareBudget(w http.ResponseWriter, r *http.Request)      { /* ... */ }
func GetSharedBudgets(w http.ResponseWriter, r *http.Request) { /* ... */ }

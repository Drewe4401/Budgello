// handlers.go
package main

import (
	"database/sql"
	"encoding/json"
	"log"
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

type Category struct {
	ID     int    `json:"id"`
	UserID int    `json:"user_id"`
	Name   string `json:"name"`
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

// --- HELPER FUNCTIONS ---

// respondWithError sends a JSON error message.
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

// respondWithJSON sends a JSON response.
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// --- USER HANDLERS ---

func RegisterUser(w http.ResponseWriter, r *http.Request) {
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), 8)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}
	err = db.QueryRow("INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id", u.Username, string(hashedPassword)).Scan(&u.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to register user")
		return
	}
	u.Password = "" // Do not send password back
	respondWithJSON(w, http.StatusCreated, u)
}

func LoginUser(w http.ResponseWriter, r *http.Request) {
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	var storedUser User
	row := db.QueryRow("SELECT id, password, role FROM users WHERE username=$1", u.Username)
	if err := row.Scan(&storedUser.ID, &storedUser.Password, &storedUser.Role); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusUnauthorized, "Invalid username or password")
		} else {
			respondWithError(w, http.StatusInternalServerError, "Database error")
		}
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(storedUser.Password), []byte(u.Password)); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid username or password")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"message": "Login successful", "user_id": storedUser.ID, "role": storedUser.Role})
}

func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, username, role FROM users")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve users")
		return
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan user")
			return
		}
		users = append(users, u)
	}
	respondWithJSON(w, http.StatusOK, users)
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// For now, only allow updating username and role. Password updates should have a separate, more secure flow.
	_, err = db.Exec("UPDATE users SET username=$1, role=$2 WHERE id=$3", u.Username, u.Role, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update user")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "User updated successfully"})
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// The ON DELETE CASCADE in the schema will handle related data.
	res, err := db.Exec("DELETE FROM users WHERE id=$1", userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to verify deletion")
		return
	}
	if rowsAffected == 0 {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "User deleted successfully"})
}

// --- CATEGORY HANDLERS ---

func CreateCategory(w http.ResponseWriter, r *http.Request) {
	var c Category
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	err := db.QueryRow("INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id", c.UserID, c.Name).Scan(&c.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create category. It may already exist for this user.")
		return
	}
	respondWithJSON(w, http.StatusCreated, c)
}

func GetCategories(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	rows, err := db.Query("SELECT id, user_id, name FROM categories WHERE user_id=$1", userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve categories")
		return
	}
	defer rows.Close()
	var categories []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan category")
			return
		}
		categories = append(categories, c)
	}
	respondWithJSON(w, http.StatusOK, categories)
}

func UpdateCategory(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	categoryID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}
	var c Category
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	_, err = db.Exec("UPDATE categories SET name=$1 WHERE id=$2", c.Name, categoryID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update category")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Category updated successfully"})
}

func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	categoryID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}
	// Note: You might want to handle what happens to transactions using this category.
	// For now, we just delete the category.
	_, err = db.Exec("DELETE FROM categories WHERE id=$1", categoryID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete category")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Category deleted successfully"})
}

// --- TRANSACTION HANDLERS ---

func CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var t Transaction
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	// Ensure date is set if not provided
	if t.Date.IsZero() {
		t.Date = time.Now()
	}
	err := db.QueryRow("INSERT INTO transactions (user_id, description, amount, date, category_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		t.UserID, t.Description, t.Amount, t.Date, t.CategoryID).Scan(&t.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create transaction")
		return
	}
	respondWithJSON(w, http.StatusCreated, t)
}

func GetTransactions(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	rows, err := db.Query("SELECT id, user_id, description, amount, date, category_id FROM transactions WHERE user_id=$1 ORDER BY date DESC", userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve transactions")
		return
	}
	defer rows.Close()
	var transactions []Transaction
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.ID, &t.UserID, &t.Description, &t.Amount, &t.Date, &t.CategoryID); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan transaction")
			return
		}
		transactions = append(transactions, t)
	}
	respondWithJSON(w, http.StatusOK, transactions)
}

func UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	transactionID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid transaction ID")
		return
	}
	var t Transaction
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	_, err = db.Exec("UPDATE transactions SET description=$1, amount=$2, date=$3, category_id=$4 WHERE id=$5",
		t.Description, t.Amount, t.Date, t.CategoryID, transactionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update transaction")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Transaction updated successfully"})
}

func DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	transactionID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid transaction ID")
		return
	}
	_, err = db.Exec("DELETE FROM transactions WHERE id=$1", transactionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete transaction")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Transaction deleted successfully"})
}

// --- BUDGET HANDLERS ---

func CreateBudget(w http.ResponseWriter, r *http.Request) {
	var b Budget
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	err := db.QueryRow("INSERT INTO budgets (user_id, period, frequency, amount) VALUES ($1, $2, $3, $4) RETURNING id",
		b.UserID, b.Period, b.Frequency, b.Amount).Scan(&b.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create budget")
		return
	}
	respondWithJSON(w, http.StatusCreated, b)
}

func GetBudgets(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	rows, err := db.Query("SELECT id, user_id, period, frequency, amount FROM budgets WHERE user_id=$1", userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve budgets")
		return
	}
	defer rows.Close()
	var budgets []Budget
	for rows.Next() {
		var b Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.Period, &b.Frequency, &b.Amount); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan budget")
			return
		}
		budgets = append(budgets, b)
	}
	respondWithJSON(w, http.StatusOK, budgets)
}

func UpdateBudget(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	budgetID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid budget ID")
		return
	}
	var b Budget
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	_, err = db.Exec("UPDATE budgets SET period=$1, frequency=$2, amount=$3 WHERE id=$4",
		b.Period, b.Frequency, b.Amount, budgetID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update budget")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Budget updated successfully"})
}

func DeleteBudget(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	budgetID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid budget ID")
		return
	}
	// Also delete associated shares
	_, err = db.Exec("DELETE FROM shared_budgets WHERE budget_id=$1", budgetID)
	if err != nil {
		log.Printf("Could not delete shared budgets for budget ID %d: %v", budgetID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete associated shares")
		return
	}
	_, err = db.Exec("DELETE FROM budgets WHERE id=$1", budgetID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete budget")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Budget deleted successfully"})
}

// --- SHARING HANDLERS ---

func ShareBudget(w http.ResponseWriter, r *http.Request) {
	var sb SharedBudget
	if err := json.NewDecoder(r.Body).Decode(&sb); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Verify the `to_user_id` exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)", sb.ToUserID).Scan(&exists)
	if err != nil || !exists {
		respondWithError(w, http.StatusBadRequest, "User to share with does not exist.")
		return
	}

	err = db.QueryRow("INSERT INTO shared_budgets (budget_id, from_user_id, to_user_id) VALUES ($1, $2, $3) RETURNING id",
		sb.BudgetID, sb.FromUserID, sb.ToUserID).Scan(&sb.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to share budget. It might already be shared with this user.")
		return
	}
	respondWithJSON(w, http.StatusCreated, sb)
}

func GetSharedBudgets(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	userID, err := strconv.Atoi(params["user_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// This query gets budgets shared *with* the specified user.
	query := `
        SELECT b.id, b.user_id, b.period, b.frequency, b.amount
        FROM budgets b
        JOIN shared_budgets sb ON b.id = sb.budget_id
        WHERE sb.to_user_id = $1`

	rows, err := db.Query(query, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve shared budgets")
		return
	}
	defer rows.Close()

	var budgets []Budget
	for rows.Next() {
		var b Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.Period, &b.Frequency, &b.Amount); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan shared budget")
			return
		}
		budgets = append(budgets, b)
	}
	respondWithJSON(w, http.StatusOK, budgets)
}

func DeleteSharedBudget(w http.ResponseWriter, r *http.Request) {
	// This would typically be based on the share ID itself, or a combination of budget_id and to_user_id
	params := mux.Vars(r)
	shareID, err := strconv.Atoi(params["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid share ID")
		return
	}

	_, err = db.Exec("DELETE FROM shared_budgets WHERE id=$1", shareID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to unshare budget")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Budget unshared successfully"})
}

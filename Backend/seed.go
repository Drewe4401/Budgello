// seed.go
package main

import (
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func seedDatabase() error {
	// Check if users already exist to prevent re-seeding
	var userCount int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
	if err != nil {
		return err
	}
	if userCount > 0 {
		log.Println("Database already seeded. Skipping.")
		return nil
	}

	log.Println("Seeding database with initial data...")

	// --- Seed Users with Roles ---
	hashedPasswordAlice, _ := bcrypt.GenerateFromPassword([]byte("password123"), 8)
	hashedPasswordBob, _ := bcrypt.GenerateFromPassword([]byte("password456"), 8)

	// Alice is an admin, Bob is a user (using the default value)
	_, err = db.Exec("INSERT INTO users (username, password, role) VALUES ('alice', $1, 'admin')", string(hashedPasswordAlice))
	if err != nil {
		return err
	}
	_, err = db.Exec("INSERT INTO users (username, password) VALUES ('bob', $1)", string(hashedPasswordBob))
	if err != nil {
		return err
	}
	log.Println("Seeded users.")

	// --- Seed Categories ---
	categories := []string{"Groceries", "Transport", "Entertainment", "Utilities", "Rent", "Health"}
	for _, cat := range categories {
		_, err := db.Exec("INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", cat)
		if err != nil {
			return err
		}
	}
	log.Println("Seeded categories.")

	// --- Seed Transactions ---
	// Alice's Transactions (UserID: 1, CategoryIDs: 1-6)
	transactions := []Transaction{
		{UserID: 1, Description: "Weekly grocery run", Amount: 125.50, Date: time.Now().AddDate(0, 0, -5), CategoryID: 1},
		{UserID: 1, Description: "Gas for car", Amount: 45.00, Date: time.Now().AddDate(0, 0, -4), CategoryID: 2},
		{UserID: 1, Description: "Movie tickets", Amount: 32.00, Date: time.Now().AddDate(0, 0, -3), CategoryID: 3},
		{UserID: 1, Description: "Electricity bill", Amount: 85.75, Date: time.Now().AddDate(0, 0, -2), CategoryID: 4},
		{UserID: 1, Description: "Monthly rent", Amount: 1200.00, Date: time.Now().AddDate(0, 0, -1), CategoryID: 5},
	}
	// Bob's Transactions (UserID: 2)
	transactions = append(transactions,
		Transaction{UserID: 2, Description: "Supermarket", Amount: 78.90, Date: time.Now().AddDate(0, 0, -6), CategoryID: 1},
		Transaction{UserID: 2, Description: "Bus pass", Amount: 55.00, Date: time.Now().AddDate(0, 0, -5), CategoryID: 2},
		Transaction{UserID: 2, Description: "Concert", Amount: 150.00, Date: time.Now().AddDate(0, 0, -2), CategoryID: 3},
		Transaction{UserID: 2, Description: "Pharmacy", Amount: 25.30, Date: time.Now().AddDate(0, 0, -1), CategoryID: 6},
	)

	for _, t := range transactions {
		_, err := db.Exec("INSERT INTO transactions (user_id, description, amount, date, category_id) VALUES ($1, $2, $3, $4, $5)",
			t.UserID, t.Description, t.Amount, t.Date, t.CategoryID)
		if err != nil {
			return err
		}
	}
	log.Println("Seeded transactions.")

	// --- Seed Budgets ---
	now := time.Now()
	// Alice's Budgets (UserID: 1)
	budgets := []Budget{
		{UserID: 1, CategoryID: 1, Amount: 500.00, Month: int(now.Month()), Year: now.Year()}, // Groceries
		{UserID: 1, CategoryID: 2, Amount: 150.00, Month: int(now.Month()), Year: now.Year()}, // Transport
		{UserID: 1, CategoryID: 3, Amount: 200.00, Month: int(now.Month()), Year: now.Year()}, // Entertainment
	}
	// Bob's Budgets (UserID: 2)
	budgets = append(budgets,
		Budget{UserID: 2, CategoryID: 1, Amount: 400.00, Month: int(now.Month()), Year: now.Year()}, // Groceries
	)

	for _, b := range budgets {
		_, err := db.Exec("INSERT INTO budgets (user_id, category_id, amount, month, year) VALUES ($1, $2, $3, $4, $5)",
			b.UserID, b.CategoryID, b.Amount, b.Month, b.Year)
		if err != nil {
			return err
		}
	}
	log.Println("Seeded budgets.")

	// --- Seed Shared Budget ---
	// Alice (UserID 1) shares her Entertainment budget (BudgetID 3) with Bob (UserID 2)
	_, err = db.Exec("INSERT INTO shared_budgets (budget_id, from_user_id, to_user_id) VALUES (3, 1, 2)")
	if err != nil {
		return err
	}
	log.Println("Seeded shared budget.")

	log.Println("Database seeding complete.")
	return nil
}

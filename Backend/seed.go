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

	// Alice is an admin, Bob is a user
	var aliceID, bobID int
	err = db.QueryRow("INSERT INTO users (username, password, role) VALUES ('alice', $1, 'admin') RETURNING id", string(hashedPasswordAlice)).Scan(&aliceID)
	if err != nil {
		return err
	}
	err = db.QueryRow("INSERT INTO users (username, password) VALUES ('bob', $1) RETURNING id", string(hashedPasswordBob)).Scan(&bobID)
	if err != nil {
		return err
	}
	log.Println("Seeded users.")

	// --- Seed Categories for each user ---
	aliceCategories := map[string]int{}
	bobCategories := map[string]int{}

	// Alice's Categories
	for _, catName := range []string{"Groceries", "Transport", "Entertainment", "Utilities", "Rent"} {
		var catID int
		err := db.QueryRow("INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id", aliceID, catName).Scan(&catID)
		if err != nil {
			return err
		}
		aliceCategories[catName] = catID
	}

	// Bob's Categories
	for _, catName := range []string{"Groceries", "Bus Pass", "Concerts", "Health", "Food"} {
		var catID int
		err := db.QueryRow("INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id", bobID, catName).Scan(&catID)
		if err != nil {
			return err
		}
		bobCategories[catName] = catID
	}
	log.Println("Seeded user-specific categories.")

	// --- Seed Transactions ---
	// Alice's Transactions (UserID: 1)
	transactions := []Transaction{
		{UserID: aliceID, Description: "Weekly grocery run", Amount: 125.50, Date: time.Now().AddDate(0, 0, -5), CategoryID: aliceCategories["Groceries"]},
		{UserID: aliceID, Description: "Gas for car", Amount: 45.00, Date: time.Now().AddDate(0, 0, -4), CategoryID: aliceCategories["Transport"]},
		{UserID: aliceID, Description: "Movie tickets", Amount: 32.00, Date: time.Now().AddDate(0, 0, -3), CategoryID: aliceCategories["Entertainment"]},
		{UserID: aliceID, Description: "Electricity bill", Amount: 85.75, Date: time.Now().AddDate(0, 0, -2), CategoryID: aliceCategories["Utilities"]},
		{UserID: aliceID, Description: "Monthly rent", Amount: 1200.00, Date: time.Now().AddDate(0, 0, -1), CategoryID: aliceCategories["Rent"]},
	}
	// Bob's Transactions (UserID: 2)
	transactions = append(transactions,
		Transaction{UserID: bobID, Description: "Supermarket", Amount: 78.90, Date: time.Now().AddDate(0, 0, -6), CategoryID: bobCategories["Groceries"]},
		Transaction{UserID: bobID, Description: "Monthly bus pass", Amount: 55.00, Date: time.Now().AddDate(0, 0, -5), CategoryID: bobCategories["Bus Pass"]},
		Transaction{UserID: bobID, Description: "Rock concert", Amount: 150.00, Date: time.Now().AddDate(0, 0, -2), CategoryID: bobCategories["Concerts"]},
		Transaction{UserID: bobID, Description: "Pharmacy", Amount: 25.30, Date: time.Now().AddDate(0, 0, -1), CategoryID: bobCategories["Health"]},
	)

	for _, t := range transactions {
		_, err := db.Exec("INSERT INTO transactions (user_id, description, amount, date, category_id) VALUES ($1, $2, $3, $4, $5)",
			t.UserID, t.Description, t.Amount, t.Date, t.CategoryID)
		if err != nil {
			return err
		}
	}
	log.Println("Seeded transactions.")

	// --- Seed Budgets (Updated Schema) ---
	budgets := []Budget{
		{UserID: aliceID, Period: time.Now(), Frequency: "monthly", Amount: 2500.00},
		{UserID: aliceID, Period: time.Now(), Frequency: "yearly", Amount: 30000.00},
		{UserID: bobID, Period: time.Now(), Frequency: "monthly", Amount: 2200.00},
	}

	for _, b := range budgets {
		_, err := db.Exec("INSERT INTO budgets (user_id, period, frequency, amount) VALUES ($1, $2, $3, $4)",
			b.UserID, b.Period, b.Frequency, b.Amount)
		if err != nil {
			return err
		}
	}
	log.Println("Seeded budgets.")

	log.Println("Database seeding complete.")
	return nil
}

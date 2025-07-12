// database.go
package main

import "log"

func createTables() error {
	// Users table with roles
	_, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'))
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'users' created or already exists.")

	// Categories table (for spending categories)
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'categories' created or already exists.")

	// Transactions table
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            description TEXT,
            amount NUMERIC(10, 2) NOT NULL,
            date TIMESTAMP NOT NULL,
            category_id INTEGER REFERENCES categories(id)
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'transactions' created or already exists.")

	// Budgets table
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS budgets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            category_id INTEGER REFERENCES categories(id),
            amount NUMERIC(10, 2) NOT NULL,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            UNIQUE(user_id, category_id, month, year)
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'budgets' created or already exists.")

	// Shared_Budgets table
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS shared_budgets (
            id SERIAL PRIMARY KEY,
            budget_id INTEGER REFERENCES budgets(id),
            from_user_id INTEGER REFERENCES users(id),
            to_user_id INTEGER REFERENCES users(id),
            UNIQUE(budget_id, to_user_id)
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'shared_budgets' created or already exists.")

	return nil
}

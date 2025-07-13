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

	// Categories table (Updated to be user-specific)
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            UNIQUE(user_id, name)
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'categories' updated to be user-specific.")

	// Transactions table
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            description TEXT,
            amount NUMERIC(10, 2) NOT NULL,
            date TIMESTAMP NOT NULL,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'transactions' created or already exists.")

	// Budgets table (Updated Schema)
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS budgets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            period DATE NOT NULL,
            frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
            amount NUMERIC(10, 2) NOT NULL,
            UNIQUE(user_id, frequency)
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'budgets' updated or already exists.")

	// Shared_Budgets table
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS shared_budgets (
            id SERIAL PRIMARY KEY,
            budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
            from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(budget_id, to_user_id)
        )
    `)
	if err != nil {
		return err
	}
	log.Println("Table 'shared_budgets' created or already exists.")

	return nil
}

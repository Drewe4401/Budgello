Budgello - Your Personal Budgeting Dashboard
Budgello is a full-stack, self-hosted web application designed to help you take control of your finances. Track your spending, set budgets, and visualize your financial habits with an intuitive and clean dashboard. Built with a Go backend and a React frontend, and containerized with Docker for easy installation.

✨ Features
📊 Interactive Dashboard: Get a quick overview of your weekly, monthly, and yearly spending habits.

💰 Budget Management: Set weekly, monthly, and yearly budgets to stay on track.

💸 Transaction Tracking: Easily add, edit, and delete transactions and assign them to categories.

🏷️ Custom Categories: Create your own spending categories to organize your transactions.

🔒 User Authentication: Secure login system to keep your financial data private.

👑 Admin Panel: A special view for admin users to manage all users in the system.

🐳 Dockerized: The entire application stack is containerized for a simple, one-command installation using pre-built images.

🚀 Getting Started (Easy Install)
You can get the entire Budgello application running on your local machine in just a few steps. You do not need to download the source code.

Prerequisites
You must have Docker and Docker Compose installed on your machine. The easiest way to get both is by installing Docker Desktop.

Installation
Create a Folder
Create a new folder on your computer where you want to run Budgello. For example, C:\Users\YourUser\BudgelloApp.

Save the docker-compose.yml File
Save the following code as a new file named docker-compose.yml inside the folder you just created.

version: '3.8'

services:
  frontend:
    image: drewe44/budgello-frontend:latest
    ports:
      - "${FRONTEND_PORT:-5173}:80"
    depends_on:
      - backend
    restart: always

  backend:
    image: drewe44/budgello-backend:latest
    ports:
      - "8080:8080"
    environment:
      - CORS_ORIGIN=http://localhost:${FRONTEND_PORT:-5173}
      - POSTGRES_HOST=db
      - POSTGRES_PORT=${POSTGRES_PORT:-5432}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
      - POSTGRES_DB=budgello_db
      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
    depends_on:
      db:
        condition: service_healthy
    restart: always

  db:
    image: postgres:latest
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
      - POSTGRES_DB=budgello_db
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d budgello_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

volumes:
  postgres_data:

Create and Configure the .env File
In the same folder, create a new file named .env. Copy and paste the following text into it. Here you can change the default ports and set your own secure passwords.

# Frontend Port
FRONTEND_PORT=5173

# PostgreSQL Database Settings
POSTGRES_PORT=5432
POSTGRES_USER=postgres # Change this for production
POSTGRES_PASSWORD=postgres # Change this for production

# Application Admin User (created on first launch)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin # Change this for production

Launch the Application
Open a terminal or command prompt, navigate into your new folder, and run the command:

docker-compose up -d

This command will download the pre-built application images and start all the services.

Access Budgello
Once the containers are running, open your web browser and navigate to:
http://localhost:5173 (or the port you specified in FRONTEND_PORT).

Log In
Log in with the admin credentials you set in your .env file.

Stopping the Application
To stop all the running containers, run the following command from the same folder:

docker-compose down

👨‍💻 For Developers
For those interested in the source code or contributing to the project.

Tech Stack
Backend: Go, gorilla/mux, PostgreSQL (lib/pq), bcrypt

Frontend: React, Vite, Tailwind CSS, Recharts, Lucide React

DevOps: Docker, Docker Compose, Nginx

Project Structure (Source Code)
The source code repository is organized as follows:

.
├── backend/              # Contains the Go backend application
│   ├── main.go
│   ├── handlers.go
│   └── ...
├── frontend/
│   └── budgello/         # Contains the React frontend application
│       ├── public/
│       ├── src/
│       ├── nginx.conf
│       └── Dockerfile
├── .env.example
└── docker-compose.yml

Contributing
The source code is hosted on GitHub. Contributions, issues, and feature requests are welcome!

Repository: https://github.com/drewe44/Budgello

Issues Page: https://github.com/drewe44/Budgello/issues

📄 License
This project is licensed under the GPL-3.0 License.

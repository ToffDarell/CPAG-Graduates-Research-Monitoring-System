# CPAG Graduate Research Monitoring System — Docker Deployment Guide

## Prerequisites

- A Linux server (Ubuntu 20.04+ recommended)
- [Docker Engine](https://docs.docker.com/engine/install/ubuntu/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed
- Git installed

---

## Step 1 — Clone the Repository on the Server

```bash
git clone https://github.com/ToffDarell/CPAG-Graduates-Research-Monitoring-System.git
cd CPAG-Graduates-Research-Monitoring-System
```

---

## Step 2 — Configure Backend Environment

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Change these values to match your server:

| Variable | What to change |
|---|---|
| `FRONTEND_URL` | `http://YOUR_SERVER_IP:3000` |
| `CORS_ORIGINS` | `http://YOUR_SERVER_IP:3000` |
| `JWT_SECRET` | Any long random string |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your admin credentials |
| `GOOGLE_REDIRECT_URI` | `http://YOUR_SERVER_IP:5000/api/...` |
| `SMTP_*` | Your Gmail / SMTP credentials |

> **Note:** Leave `MONGO_URI=mongodb://mongodb:27017/cpagthesis` — Docker Compose sets this automatically.

---

## Step 3 — Build and Start All Containers

```bash
docker compose up -d --build
```

This will:
1. Pull the `mongo:7` image
2. Build the **backend** image (Express API on port 5000)
3. Build the **frontend** image (Vite preview on port 3000)
4. Start all three containers

---

## Step 4 — Verify Containers Are Running

```bash
docker ps
```

You should see three containers:
- `cpag_mongodb` — running on 27017
- `cpag_backend` — running on **5000**
- `cpag_frontend` — running on **3000**

---

## Step 5 — Access the Application

Open your browser:
```
http://YOUR_SERVER_IP:3000
```

The API is available at:
```
http://YOUR_SERVER_IP:5000/api
```

---

## Useful Commands

```bash
# View live logs from all containers
docker compose logs -f

# View logs from only the backend
docker compose logs -f backend

# Stop all containers
docker compose down

# Stop and remove volumes (DELETES DATABASE)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Restart a single container
docker compose restart backend
```

---

## Uploading Files / Persistence

Uploaded research documents are stored in a Docker named volume (`uploads_data`).
MongoDB data is stored in another volume (`mongodb_data`).
Both survive container restarts and `docker compose down` (but NOT `docker compose down -v`).
